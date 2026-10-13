/**
 * The month shown is where one looks, so it is not part of the query. Seven days across a phone leave no room for a
 * title: there each day is its number, and the tapped day's issues are listed under the month, without dragging.
 */
import { Button } from "@entwine/ui/components/ui/button";
import { cn } from "@entwine/ui/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { WEEKDAYS } from "../../../../../constants/issue-view";
import { useFits } from "../../../../../hooks/use-fits";
import { useToday } from "../../../../../hooks/use-today";
import { monthDays, shiftMonth, spoken } from "../../../../../lib/calendar";
import type { LayoutProps } from "../../../../../types/issue-view";
import type { Issue } from "../../../../../types/rows";
import { DayIssue } from "./day-issue";
import { DayIssues } from "./day-issues";

/** The narrowest calendar, in pixels, whose days still hold a readable title. */
const TITLES_FIT = 640;

const NONE: Issue[] = [];

export function IssueCalendar({ issues, store, peekId, onPeek }: LayoutProps) {
  const today = useToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [over, setOver] = useState<string | null>(null);
  /** The day whose issues the narrow calendar lists. */
  const [selected, setSelected] = useState(today);
  const [calendar, wide] = useFits(TITLES_FIT);
  // Dragging over a day renders the calendar again: the days are made once per change of the shown issues.
  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, Issue[]>();
    let undated = 0;
    for (const issue of issues) {
      if (!issue.dueDate) undated++;
      else {
        const bucket = byDay.get(issue.dueDate);
        if (bucket) bucket.push(issue);
        else byDay.set(issue.dueDate, [issue]);
      }
    }
    return { byDay, undated };
  }, [issues]);
  const title = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const days = monthDays(month);
  const drop = (day: string) => (event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    const issue = store.issues.get(event.dataTransfer.getData("text/issue-id"));
    if (issue && issue.dueDate !== day) void store.issues.update(issue.id, { dueDate: day });
  };

  return (
    <div ref={calendar} className="@container/calendar flex h-full flex-col">
      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1 border-b px-4 py-1">
        <h2 className="mr-2 text-body font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => {
            setMonth(today.slice(0, 7));
            setSelected(today);
          }}
        >
          Today
        </Button>
        {undated > 0 && (
          <span className="ml-auto text-caption text-muted-foreground">
            {undated} {undated === 1 ? "issue has" : "issues have"} no due date
          </span>
        )}
      </div>
      <div aria-hidden className="grid shrink-0 grid-cols-7 border-b">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={cn("py-1.5 text-caption font-medium text-muted-foreground", wide ? "px-2" : "text-center")}
          >
            {day}
          </div>
        ))}
      </div>
      {wide ? (
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
          {days.map((day, index) => {
            const inMonth = day.startsWith(month);
            return (
              // A group, not a region: a month of landmarks would bury the page's own.
              <div
                key={day}
                role="group"
                data-day={day}
                aria-label={spoken(day)}
                className={cn(
                  "flex min-h-28 min-w-0 flex-col gap-1 border-b p-1.5 transition-colors",
                  index % 7 !== 6 && "border-r",
                  !inMonth && "bg-muted/30",
                  index % 7 >= 5 && inMonth && "bg-muted/15",
                  over === day && "bg-primary/10",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver(day);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null);
                }}
                onDrop={drop(day)}
              >
                <span
                  aria-current={day === today ? "date" : undefined}
                  className={cn(
                    "flex size-6 items-center justify-center self-start rounded-full text-caption tabular-nums",
                    inMonth ? "text-foreground" : "text-muted-foreground",
                    day === today && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                <DayIssues day={day} issues={byDay.get(day) ?? NONE} store={store} peekId={peekId} onPeek={onPeek} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 border-b">
            {days.map((day) => {
              const count = byDay.get(day)?.length ?? 0;
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  aria-pressed={day === selected}
                  aria-label={`${spoken(day)}, ${count} ${count === 1 ? "issue" : "issues"}`}
                  className={cn(
                    "flex h-14 flex-col items-center gap-0.5 pt-2 text-body outline-none focus-visible:bg-accent",
                    !day.startsWith(month) && "text-muted-foreground",
                  )}
                  onClick={() => setSelected(day)}
                >
                  <span
                    aria-current={day === today ? "date" : undefined}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full tabular-nums",
                      day === selected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : day === today && "bg-primary/10 font-semibold text-primary-text",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {/* The count says which days are worth a tap. */}
                  {count > 0 && <span className="text-micro text-muted-foreground tabular-nums">{count}</span>}
                </button>
              );
            })}
          </div>
          <section aria-label={`Issues due ${spoken(selected)}`} className="flex flex-col gap-1.5 p-4">
            <h3 className="pb-1 text-body font-semibold">{spoken(selected)}</h3>
            {(byDay.get(selected) ?? NONE).map((issue) => (
              <DayIssue key={issue.id} issue={issue} store={store} peeked={peekId === issue.id} onPeek={onPeek} roomy />
            ))}
            {!byDay.has(selected) && <p className="text-body text-muted-foreground">Nothing is due this day.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

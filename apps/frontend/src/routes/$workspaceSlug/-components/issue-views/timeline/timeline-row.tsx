import { addDays } from "@entwine/shared";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { cn } from "@entwine/ui/lib/utils";
import { type PointerEvent, useState } from "react";
import { daysBetween, formatRange } from "../../../../../lib/dates";
import { type DragMode, draggedDates, spanOf } from "../../../../../lib/timeline";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { IssueLink } from "../issue-link";
import { IssueContextMenu } from "../issue-menu/issue-context-menu";

/** Dragging the bar moves both dates, dragging an end one; clicking an undated issue's track schedules it there. */
export function TimelineRow({
  issue,
  store,
  first,
  px,
  width,
  sidebar,
  top,
  peeked,
  onPeek,
}: {
  issue: Issue;
  store: Store;
  first: string;
  /** A day's width, in pixels, and that of all the days shown. */
  px: number;
  width: number;
  /** The width of the column that stays, as CSS. */
  sidebar: string;
  /** Where the row is, in pixels from the first row. */
  top: number;
  peeked: boolean;
  onPeek(issueId: string): void;
}) {
  const [drag, setDrag] = useState<{ mode: DragMode; x: number; days: number } | null>(null);
  /** The day under the pointer, on the track of an undated issue. */
  const [hover, setHover] = useState<string | null>(null);
  const key = store.issues.key(issue);
  const state = store.states.get(issue.stateId);
  const moving = drag !== null && drag.days !== 0;
  const span = spanOf(moving ? { ...issue, ...draggedDates(issue, drag.mode, drag.days) } : issue);
  const length = issue.startDate && issue.dueDate ? daysBetween(issue.startDate, issue.dueDate) + 1 : null;
  const dayAt = (x: number) => addDays(first, Math.floor(x / px));

  /** Drags by whole days and writes the dates once, on release. An end's handlers keep its events from the bar. */
  const dragHandlers = (mode: DragMode) => ({
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ mode, x: event.clientX, days: 0 });
    },
    onPointerMove(event: PointerEvent) {
      event.stopPropagation();
      if (drag) setDrag({ ...drag, days: Math.round((event.clientX - drag.x) / px) });
    },
    onPointerUp(event: PointerEvent) {
      event.stopPropagation();
      if (!drag) return;
      setDrag(null);
      // A drag that ends where it began is a click.
      if (drag.days === 0) {
        if (drag.mode === "move") onPeek(issue.id);
        return;
      }
      void store.issues.update(issue.id, draggedDates(issue, drag.mode, drag.days));
    },
    onPointerCancel() {
      setDrag(null);
    },
  });

  return (
    <li
      className="absolute top-0 left-0 flex h-10 w-full border-b"
      style={{ transform: `translateY(${top}px)` }}
      data-testid="timeline-row"
    >
      <div
        className={cn(
          "sticky left-0 z-[2] flex shrink-0 items-center gap-2 border-r bg-background px-4",
          peeked && "bg-accent",
        )}
        style={{ width: sidebar }}
      >
        {state && <StateIcon type={state.group} color={state.color} className="size-3.5!" />}
        <span className="shrink-0 text-caption font-medium text-muted-foreground tabular-nums">{key}</span>
        <IssueLink issue={issue} className="min-w-0 flex-1 truncate text-body" />
        {length !== null && (
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
            {length} {length === 1 ? "day" : "days"}
          </span>
        )}
      </div>
      <div
        className={cn("relative", !span && "cursor-pointer")}
        style={{ width }}
        onPointerMove={(event) => !span && setHover(dayAt(event.nativeEvent.offsetX))}
        onPointerLeave={() => setHover(null)}
        onClick={(event) => {
          if (span || event.target !== event.currentTarget) return;
          const day = dayAt(event.nativeEvent.offsetX);
          void store.issues.update(issue.id, { startDate: day, dueDate: day });
        }}
        data-testid="timeline-track"
      >
        {span ? (
          <IssueContextMenu
            issue={issue}
            store={store}
            render={
              <button
                type="button"
                data-testid="timeline-bar"
                data-start={span.start}
                data-end={span.end}
                aria-label={`${key}: ${formatRange(span.start, span.end)}`}
                className={cn(
                  "absolute top-2 flex h-6 cursor-grab touch-none items-center rounded-md border bg-card shadow-xs select-none hover:border-foreground/20",
                  moving && "cursor-grabbing border-primary/60",
                  peeked && "border-primary/50 ring-1 ring-primary/30",
                )}
                style={{
                  left: daysBetween(first, span.start) * px,
                  width: (daysBetween(span.start, span.end) + 1) * px,
                  borderLeftColor: state?.color,
                  borderLeftWidth: 3,
                }}
                {...dragHandlers("move")}
                // Pointer releases open the peek; this is Enter and Space.
                onClick={(event) => event.detail === 0 && onPeek(issue.id)}
              />
            }
          >
            {(["start", "end"] as const).map((edge) => (
              <span
                key={edge}
                aria-hidden
                data-testid={`timeline-${edge}`}
                className={cn(
                  "absolute inset-y-0 z-[1] w-1.5 cursor-ew-resize rounded-sm hover:bg-primary/40",
                  edge === "start" ? "-left-1" : "-right-1",
                )}
                {...dragHandlers(edge)}
              />
            ))}
            {px * (daysBetween(span.start, span.end) + 1) >= 60 && (
              <span className="truncate px-2 text-caption">{issue.title}</span>
            )}
          </IssueContextMenu>
        ) : (
          hover && (
            <span
              aria-hidden
              className="pointer-events-none absolute top-2 h-6 rounded-md border border-dashed border-primary/60 bg-primary/10"
              style={{ left: daysBetween(first, hover) * px, width: Math.max(px, 4) }}
            />
          )
        )}
      </div>
    </li>
  );
}

/** The scale and the range shown are where one looks, so not part of the query; grouping is ignored. */

import { addDays } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@entwine/ui/components/ui/toggle-group";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OVERSCAN, SCALES, type Scale } from "../../../../../constants/issue-view";
import { useToday } from "../../../../../hooks/use-today";
import { daysBetween } from "../../../../../lib/dates";
import { mondayOf } from "../../../../../lib/timeline";
import { type LayoutProps } from "../../../../../types/issue-view";
import { TimelineRow } from "./timeline-row";
import { TimelineScale } from "./timeline-scale";

/** The width of the column of issues, which stays while the days scroll. */
const SIDEBAR = "min(320px, 50cqw)";
/** The height `h-11` gives the scale, which the rows start under. */
const HEADER_HEIGHT = 44;
/** How many days the range grows by when scrolled to one of its edges. */
const GROWTH = 56;

export function IssueTimeline({ issues, store, peekId, onPeek }: LayoutProps) {
  const today = useToday();
  const [scale, setScale] = useState<Scale>("month");
  const px = SCALES[scale];
  /** Days added before and after the range by scrolling to its edges. */
  const [grown, setGrown] = useState({ before: 0, after: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const issueColumn = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 40,
    getItemKey: useCallback((index: number) => issues[index].id, [issues]),
    overscan: OVERSCAN,
    scrollMargin: HEADER_HEIGHT,
  });
  /** Pixels to scroll right once days were added before the range, so that the view stays where it was. */
  const shift = useRef(0);

  // Scrolling renders the timeline again: the range is found once per change of the shown issues.
  const { earliest, latest } = useMemo(() => {
    let earliest = today;
    let latest = today;
    for (const { startDate, dueDate } of issues)
      for (const date of [startDate, dueDate]) {
        if (!date) continue;
        if (date < earliest) earliest = date;
        if (date > latest) latest = date;
      }
    return { earliest, latest };
  }, [issues, today]);
  const first = addDays(mondayOf(addDays(earliest, -28)), -grown.before);
  const count = daysBetween(first, latest) + 56 + grown.after;
  const width = count * px;

  /** Scrolls today a third of the way into the chart. */
  const toToday = () => {
    const el = scroller.current;
    if (el)
      el.scrollLeft = daysBetween(first, today) * px - (el.clientWidth - (issueColumn.current?.offsetWidth ?? 0)) / 3;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the timeline opens on today, and again when the scale changes.
  useLayoutEffect(toToday, [px]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs once days were added before the range.
  useLayoutEffect(() => {
    if (shift.current && scroller.current) scroller.current.scrollLeft += shift.current;
    shift.current = 0;
  }, [grown.before]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    if (el.scrollLeft < px * 7) {
      shift.current = GROWTH * px;
      setGrown((g) => ({ ...g, before: g.before + GROWTH }));
    } else if (el.scrollLeft + el.clientWidth > el.scrollWidth - px * 7)
      setGrown((g) => ({ ...g, after: g.after + GROWTH }));
  };

  return (
    <div className="@container/timeline flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
        <ToggleGroup
          aria-label="Scale"
          size="sm"
          variant="outline"
          spacing={0}
          value={[scale]}
          onValueChange={(value) => value[0] && setScale(value[0] as Scale)}
        >
          {(Object.keys(SCALES) as Scale[]).map((s) => (
            <ToggleGroupItem key={s} value={s} className="h-7 px-2.5 text-body capitalize">
              {s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="outline" size="xs" onClick={toToday}>
          Today
        </Button>
      </div>
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <div className="relative" style={{ width: `calc(${SIDEBAR} + ${width}px)` }}>
          {/* The range starts on a Monday, so weekends repeat every week. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{
              left: SIDEBAR,
              width,
              background: `repeating-linear-gradient(to right, transparent 0 ${px * 5}px, var(--muted) ${px * 5}px ${px * 7}px)`,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-[1] w-px bg-primary"
            style={{ left: `calc(${SIDEBAR} + ${daysBetween(first, today) * px + px / 2}px)` }}
          />
          <div className="sticky top-0 z-[3] flex h-11 border-b bg-background">
            <div
              ref={issueColumn}
              className="sticky left-0 z-[1] flex shrink-0 items-end border-r bg-background px-4 pb-1.5 text-caption font-medium text-muted-foreground"
              style={{ width: SIDEBAR }}
            >
              Issues
            </div>
            <TimelineScale first={first} count={count} px={px} today={today} />
          </div>
          <ul aria-label="Timeline" className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const issue = issues[item.index];
              return (
                <TimelineRow
                  key={issue.id}
                  issue={issue}
                  store={store}
                  first={first}
                  px={px}
                  width={width}
                  sidebar={SIDEBAR}
                  top={item.start - HEADER_HEIGHT}
                  peeked={peekId === issue.id}
                  onPeek={onPeek}
                />
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

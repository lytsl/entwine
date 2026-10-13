import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useRef } from "react";
import { spoken } from "../../../../../lib/calendar";
import type { LayoutProps } from "../../../../../types/issue-view";
import { DayIssue } from "./day-issue";

/** Each day keeps its full list scrollable while mounting only the cards near that day's viewport. */
export function DayIssues({
  day,
  issues,
  store,
  peekId,
  onPeek,
}: Pick<LayoutProps, "issues" | "store" | "peekId" | "onPeek"> & { day: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 28,
    getItemKey: useCallback((index: number) => issues[index].id, [issues]),
    overscan: 2,
  });
  return (
    <>
      {issues.length > 0 && (
        <span className="text-micro text-muted-foreground">
          {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </span>
      )}
      <div
        ref={scroller}
        role="group"
        data-calendar-scroll
        tabIndex={issues.length ? 0 : undefined}
        aria-label={`Issues due ${spoken(day)}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const issue = issues[item.index];
            return (
              <div
                key={issue.id}
                className="absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <DayIssue issue={issue} store={store} peeked={peekId === issue.id} onPeek={onPeek} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

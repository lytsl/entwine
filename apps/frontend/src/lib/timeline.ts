import { addDays } from "@entwine/shared";
import type { IssuePatch } from "../store";
import type { Issue } from "../types/rows";

/** The Monday on or before `day`. */
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

export const monthName = (day: string, year: boolean) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    ...(year && { year: "numeric" }),
    timeZone: "UTC",
  });

/** A bar's days: both dates, or the one it has; null for an undated issue. */
export function spanOf(issue: Pick<Issue, "startDate" | "dueDate">): { start: string; end: string } | null {
  const start = issue.startDate ?? issue.dueDate;
  const end = issue.dueDate ?? issue.startDate;
  return start && end ? { start, end } : null;
}

/** A drag takes hold of the whole bar, or one of its ends. */
export type DragMode = "move" | "start" | "end";

/** A move shifts the dates the issue has; an end never passes the other. */
export function draggedDates(issue: Issue, mode: DragMode, days: number): IssuePatch {
  const span = spanOf(issue)!;
  if (mode === "move")
    return {
      ...(issue.startDate && { startDate: addDays(issue.startDate, days) }),
      ...(issue.dueDate && { dueDate: addDays(issue.dueDate, days) }),
    };
  if (mode === "start") {
    const start = addDays(span.start, days);
    return { startDate: start > span.end ? span.end : start };
  }
  const end = addDays(span.end, days);
  return { dueDate: end < span.start ? span.start : end };
}

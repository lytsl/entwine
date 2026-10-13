import { addDays, localToday, type StateGroup } from "@entwine/shared";
import type { DueTone } from "@entwine/ui/components/ui/date-picker";
import { formatDate } from "@entwine/ui/lib/dates";

/** "Oct 1 – Oct 14", or one date when both are the same day; the year shows where it is not this year. */
export function formatRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return start ? `From ${formatDate(start)}` : end ? `Until ${formatDate(end)}` : null;
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

/** Whole days between two ISO dates; negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** How long a window has left, counting its last day: "Ends today", "3 days left". */
export function daysLeft(end: string, today: string): string {
  const days = daysBetween(today, end) + 1;
  return days <= 1 ? "Ends today" : `${days} days left`;
}

/** Late before today, due soon within three days; a completed or cancelled issue is never late. */
export function dueTone(dueDate: string | null, group: StateGroup | undefined, today = localToday()): DueTone {
  if (!dueDate || group === "completed" || group === "cancelled") return null;
  if (dueDate < today) return "overdue";
  return dueDate <= addDays(today, 3) ? "soon" : null;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago". */
export function timeAgo(ms: number, now = Date.now()): string {
  let value = (ms - now) / 1000;
  if (Math.abs(value) < 45) return "just now";
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return RELATIVE.format(Math.round(value), unit);
    value /= size;
  }
  return RELATIVE.format(Math.round(value), "year");
}

export const fullTime = (ms: number) =>
  new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

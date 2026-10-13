import { addDays } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { daysBetween } from "../../../../../lib/dates";
import { monthName } from "../../../../../lib/timeline";

/** For the eye only: each bar's name carries its dates. */
export function TimelineScale({
  first,
  count,
  px,
  today,
}: {
  first: string;
  count: number;
  /** A day's width, in pixels. */
  px: number;
  today: string;
}) {
  const days = Array.from({ length: count }, (_, i) => addDays(first, i));
  const months = days.filter((day, i) => i === 0 || day.endsWith("-01"));
  const ticks = px >= 20 ? days : days.filter((_, i) => i % 7 === 0);
  return (
    <div aria-hidden className="relative" style={{ width: count * px }}>
      {months.map((day) => (
        <span
          key={day}
          className="absolute top-1 pl-1.5 text-caption font-medium whitespace-nowrap"
          style={{ left: daysBetween(first, day) * px }}
        >
          {monthName(day, day.slice(0, 4) !== today.slice(0, 4))}
        </span>
      ))}
      {ticks.map((day) => (
        <span
          key={day}
          className={cn(
            "absolute bottom-1 text-center text-micro text-muted-foreground tabular-nums",
            day === today && "font-semibold text-primary-text",
          )}
          style={{ left: daysBetween(first, day) * px, width: Math.max(px, 20) }}
        >
          {Number(day.slice(8))}
        </span>
      ))}
    </div>
  );
}

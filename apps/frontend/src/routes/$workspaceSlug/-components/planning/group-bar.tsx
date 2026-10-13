import { type Progress, STATE_GROUPS } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { GROUP_COLORS } from "../../../../constants/state";

/** Cancelled issues are included. */
export function GroupBar({ value, className }: { value: Progress; className?: string }) {
  return (
    <div className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      {STATE_GROUPS.map((group) =>
        value.groups[group] ? (
          <span
            key={group}
            className="h-full"
            style={{ width: `${(value.groups[group] / value.total) * 100}%`, background: GROUP_COLORS[group] }}
          />
        ) : null,
      )}
    </div>
  );
}

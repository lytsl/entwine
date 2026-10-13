import { type Progress, STATE_GROUPS, type StateGroup } from "@entwine/shared";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@entwine/ui/components/ui/tooltip";
import { cn } from "@entwine/ui/lib/utils";
import { GROUP_COLORS, GROUP_LABELS } from "../../../../constants/state";
import { pointsDone, wholePercent } from "../../../../lib/plan";
import { GroupBar } from "./group-bar";
import { ProgressRing } from "./progress-ring";

/** Picking a group filters the view below to it; the counts themselves never follow the view's filters. */
export function ProgressSummary({
  value,
  points,
  archived = 0,
  rolled = 0,
  selected = [],
  onSelectGroup,
}: {
  value: Progress;
  /** The same progress by estimate points; left out where no counted issue has an estimate. */
  points?: Progress;
  /** Archived issues leave the list but still count here, so the summary says how many. */
  archived?: number;
  /** Unfinished issues an ended cycle's rollover moved on; `value` and `points` count them as planned. */
  rolled?: number;
  selected?: readonly StateGroup[];
  onSelectGroup?(group: StateGroup): void;
}) {
  const byPoints = points && pointsDone(points);
  return (
    <section aria-label="Progress" className="flex min-w-72 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-body">
          <span className="font-semibold tabular-nums">
            {value.done} of {value.planned}
          </span>{" "}
          <span className="text-muted-foreground">done</span>
        </p>
        <ProgressRing value={value} />
      </div>
      <GroupBar value={value} />
      {byPoints && (
        <p className="text-caption text-muted-foreground tabular-nums">
          {byPoints} · {wholePercent(points)}% by estimate
        </p>
      )}
      {rolled > 0 && (
        <p className="text-caption text-muted-foreground tabular-nums">
          {rolled} unfinished {rolled === 1 ? "issue" : "issues"} moved to a later cycle
        </p>
      )}
      <ul className="flex flex-wrap gap-1.5" aria-label="Issues by state">
        {STATE_GROUPS.map((group) => (
          <li key={group}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={selected.includes(group)}
                    aria-label={`${GROUP_LABELS[group]}: ${value.groups[group]}`}
                    disabled={!onSelectGroup}
                    className={cn(
                      "flex h-6 items-center gap-1.5 rounded-md border px-1.5 text-caption text-muted-foreground tabular-nums transition-colors enabled:hover:bg-accent enabled:hover:text-foreground",
                      selected.includes(group) && "border-primary/40 bg-primary/10 text-foreground",
                    )}
                    onClick={() => onSelectGroup?.(group)}
                  />
                }
              >
                <StateIcon type={group} color={GROUP_COLORS[group]} className="size-3.5!" />
                {value.groups[group]}
              </TooltipTrigger>
              <TooltipContent>
                {GROUP_LABELS[group]}
                {group === "cancelled" && " · not counted in progress"}
                {archived > 0 && ` · ${archived} archived ${archived === 1 ? "issue is" : "issues are"} counted`}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  );
}

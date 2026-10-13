import type { CyclePhase } from "@entwine/shared";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { textColor } from "@entwine/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { CalendarIcon, CalendarSyncIcon } from "lucide-react";
import { CycleIcon } from "../../../../../../components/cycle-icon";
import { PHASE_LABELS } from "../../../../../../constants/cycle";
import { useToday } from "../../../../../../hooks/use-today";
import { formatRange } from "../../../../../../lib/dates";
import { cycleWhen, pointsDone, withRolled } from "../../../../../../lib/plan";
import { type Store } from "../../../../../../store";
import { type Cycle } from "../../../../../../types/rows";
import { ProgressRing } from "../../../../-components/planning/progress-ring";
import { PlanMenu } from "./plan-menu";

export function CycleRow({ cycle, phase, store }: { cycle: Cycle; phase: CyclePhase; store: Store }) {
  const today = useToday();
  const progress = withRolled(store.issues.progress(cycle.id), cycle.rolledIssues);
  const points = pointsDone(withRolled(store.issues.points(cycle.id), cycle.rolledPoints));
  const creator = cycle.creatorId ? store.members.get(cycle.creatorId) : undefined;
  const done = `${progress.done}/${progress.planned} done`;
  return (
    <div
      role="listitem"
      aria-label={cycle.name}
      className="group/row relative flex min-h-14 items-center gap-3 border-b px-4 py-2 hover:bg-accent/40 @min-[30rem]/main:gap-4"
    >
      <CycleIcon phase={phase} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          from="/$workspaceSlug"
          to="/$workspaceSlug/projects/$projectId/cycles/$cycleId"
          params={{ projectId: cycle.projectId, cycleId: cycle.id }}
          className="truncate text-body font-medium after:absolute after:inset-0"
        >
          {cycle.name}
        </Link>
        {cycle.description && (
          <span className="hidden truncate text-caption text-muted-foreground @min-[30rem]/main:inline">
            {cycle.description}
          </span>
        )}
        {/* Where the row has no room for a column of counts, they are the name's second line. */}
        <span className="truncate text-caption text-muted-foreground tabular-nums @min-[30rem]/main:hidden">
          {points ? `${done} · ${points}` : done}
        </span>
      </div>
      <span
        className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-caption font-medium @min-[40rem]/main:inline"
        style={{
          color: textColor(PHASE_LABELS[phase].color),
          background: `color-mix(in oklch, ${PHASE_LABELS[phase].color} 12%, transparent)`,
        }}
      >
        {cycleWhen(cycle, phase, today)}
      </span>
      <span className="hidden w-44 shrink-0 items-center gap-1.5 text-caption text-muted-foreground @min-[52rem]/main:flex">
        <CalendarIcon className="size-3.5" />
        {formatRange(cycle.startDate, cycle.endDate)}
      </span>
      <span className="hidden w-24 shrink-0 flex-col text-caption text-muted-foreground tabular-nums @min-[30rem]/main:flex">
        <span>{done}</span>
        {points && <span>{points}</span>}
      </span>
      <ProgressRing value={progress} />
      {/* Who made it is on the cycle's page; a phone's row keeps the room for the name. */}
      <span className="hidden shrink-0 @min-[30rem]/main:flex">
        {cycle.creatorId ? (
          <UserAvatar user={creator} size={20} />
        ) : (
          <span
            role="img"
            aria-label="Created by the schedule"
            title="Created by the schedule"
            className="flex size-5 items-center justify-center text-muted-foreground"
          >
            <CalendarSyncIcon className="size-4" />
          </span>
        )}
      </span>
      <PlanMenu
        kind="cycle"
        plan={cycle}
        store={store}
        issueCount={progress.total - cycle.rolledIssues}
        className="relative z-[1] text-muted-foreground"
      />
    </div>
  );
}

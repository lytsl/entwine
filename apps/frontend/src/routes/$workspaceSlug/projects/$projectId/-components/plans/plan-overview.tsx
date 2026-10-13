import { type IssueQuery, type ModuleStatus } from "@entwine/shared";
import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { formatDate } from "@entwine/ui/lib/dates";
import { textColor } from "@entwine/ui/lib/utils";
import { CalendarSyncIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CycleIcon } from "../../../../../../components/cycle-icon";
import { PHASE_LABELS } from "../../../../../../constants/cycle";
import { useToday } from "../../../../../../hooks/use-today";
import { daysLeft } from "../../../../../../lib/dates";
import { toggleFilter } from "../../../../../../lib/issue-filters";
import { cyclePhase, withRolled } from "../../../../../../lib/plan";
import type { Store } from "../../../../../../store";
import type { Cycle, Module, PlanKind } from "../../../../../../types/rows";
import { ModuleLeadSelect } from "../../../../-components/planning/module-lead-select";
import { ModuleMembersSelect } from "../../../../-components/planning/module-members-select";
import { ModuleStatusSelect } from "../../../../-components/planning/module-status-select";
import { ProgressSummary } from "../../../../-components/planning/progress-summary";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-micro font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="flex min-h-6 items-center gap-1.5 text-body">{children}</div>
    </div>
  );
}

export function PlanOverview({
  kind,
  plan,
  store,
  query,
  onChange,
}: {
  kind: PlanKind;
  plan: Cycle | Module;
  store: Store;
  query: IssueQuery;
  onChange(patch: Partial<IssueQuery>): void;
}) {
  const today = useToday();
  const frozen = store.projects.get(plan.projectId)?.archivedAt != null;
  const creator = plan.creatorId ? store.members.get(plan.creatorId) : undefined;
  const rolled = "rolledIssues" in plan ? plan : undefined;
  // A cycle always has both dates; a module's are optional.
  const date = (label: string, value: string | null, set: (next: string | null) => void, bounds: object) =>
    frozen ? (
      <span>{value ? formatDate(value) : "—"}</span>
    ) : (
      <DatePicker label={label} value={value} onChange={set} clearable={kind === "module"} {...bounds} />
    );
  let facts: ReactNode;
  if (kind === "cycle") {
    const cycle = plan as Cycle;
    const phase = cyclePhase(cycle, today);
    const setDate = (field: "startDate" | "endDate") => (next: string | null) =>
      next && store.cycles.update(cycle.id, { [field]: next });
    facts = (
      <>
        <Fact label="Phase">
          <CycleIcon phase={phase} className="size-3.5" />
          <span style={{ color: textColor(PHASE_LABELS[phase].color) }}>{PHASE_LABELS[phase].label}</span>
          {phase === "current" && <span className="text-muted-foreground">· {daysLeft(cycle.endDate, today)}</span>}
        </Fact>
        <Fact label="Dates">
          {date("Start date", cycle.startDate, setDate("startDate"), { max: cycle.endDate })}
          <span className="text-muted-foreground">→</span>
          {date("End date", cycle.endDate, setDate("endDate"), { min: cycle.startDate })}
        </Fact>
      </>
    );
  } else {
    const module = plan as Module;
    facts = (
      <>
        <Fact label="Status">
          <ModuleStatusSelect
            value={module.status}
            disabled={frozen}
            onChange={(status) => store.modules.update(module.id, { status })}
          />
        </Fact>
        <Fact label="Dates">
          {date("Start date", module.startDate, (startDate) => store.modules.update(module.id, { startDate }), {
            max: module.targetDate,
          })}
          <span className="text-muted-foreground">→</span>
          {date("Target date", module.targetDate, (targetDate) => store.modules.update(module.id, { targetDate }), {
            min: module.startDate,
          })}
        </Fact>
        <Fact label="Lead">
          <ModuleLeadSelect module={module} store={store} disabled={frozen} />
        </Fact>
        <Fact label="Members">
          <ModuleMembersSelect module={module} store={store} disabled={frozen} />
        </Fact>
      </>
    );
  }
  return (
    <div className="flex shrink-0 flex-wrap items-start gap-x-10 gap-y-4 border-b bg-muted/20 px-5 py-4">
      <div className="flex min-w-64 flex-1 flex-col gap-4">
        <p className="line-clamp-3 max-w-2xl text-body whitespace-pre-wrap text-muted-foreground">
          {plan.description || "No description"}
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {facts}
          <Fact label="Created by">
            {plan.creatorId ? (
              <>
                <UserAvatar user={creator} size={18} />
                {creator?.name ?? "Unknown"}
              </>
            ) : (
              <>
                <CalendarSyncIcon className="size-4 text-muted-foreground" />
                The schedule
              </>
            )}
          </Fact>
        </div>
      </div>
      <ProgressSummary
        value={withRolled(store.issues.progress(plan.id), rolled?.rolledIssues ?? 0)}
        points={withRolled(store.issues.points(plan.id), rolled?.rolledPoints ?? 0)}
        rolled={rolled?.rolledIssues}
        archived={store.issues.archivedIn(plan.id)}
        selected={query.groups}
        onSelectGroup={(group) => onChange(toggleFilter(query, "groups", group))}
      />
    </div>
  );
}

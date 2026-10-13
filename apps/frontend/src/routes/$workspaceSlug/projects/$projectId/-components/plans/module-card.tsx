import type { ModuleStatus } from "@entwine/shared";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { Link } from "@tanstack/react-router";
import { CalendarIcon } from "lucide-react";
import { ModuleStatusIcon } from "../../../../../../components/module-status-icon";
import { formatRange } from "../../../../../../lib/dates";
import { moduleMembers, pointsDone } from "../../../../../../lib/plan";
import { type Store } from "../../../../../../store";
import { type Module } from "../../../../../../types/rows";
import { GroupBar } from "../../../../-components/planning/group-bar";
import { MemberStack } from "../../../../-components/planning/member-stack";
import { ModuleStatusSelect } from "../../../../-components/planning/module-status-select";
import { ProgressRing } from "../../../../-components/planning/progress-ring";
import { PlanMenu } from "./plan-menu";

export function ModuleCard({ module, store }: { module: Module; store: Store }) {
  const progress = store.issues.progress(module.id);
  const frozen = store.projects.get(module.projectId)?.archivedAt != null;
  const points = pointsDone(store.issues.points(module.id));
  const lead = module.leadId ? store.members.get(module.leadId) : undefined;
  const members = moduleMembers(store, module.id);
  const range = formatRange(module.startDate, module.targetDate);
  return (
    <li
      aria-label={module.name}
      className="group/card relative flex flex-col gap-3 rounded-xl border bg-card p-4 transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-lg hover:shadow-black/10"
    >
      <div className="flex items-start gap-2">
        <ModuleStatusIcon status={module.status} className="mt-0.5" />
        <Link
          from="/$workspaceSlug"
          to="/$workspaceSlug/projects/$projectId/modules/$moduleId"
          params={{ projectId: module.projectId, moduleId: module.id }}
          className="line-clamp-2 min-w-0 flex-1 font-semibold after:absolute after:inset-0"
        >
          {module.name}
        </Link>
        <PlanMenu
          kind="module"
          plan={module}
          store={store}
          issueCount={progress.total}
          className="relative z-[1] -mt-1 -mr-2 text-muted-foreground"
        />
      </div>
      <p className="line-clamp-2 min-h-10 text-body text-muted-foreground">{module.description || "No description"}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-caption text-muted-foreground tabular-nums">
          <span>
            {progress.total === 0
              ? "No issues"
              : `${progress.done} of ${progress.planned} done · ${progress.total} ${progress.total === 1 ? "issue" : "issues"}`}
            {points && ` · ${points}`}
          </span>
          <ProgressRing value={progress} size={16} />
        </div>
        <GroupBar value={progress} />
      </div>
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <span className="relative z-[1] -ml-1.5">
          <ModuleStatusSelect
            value={module.status}
            disabled={frozen}
            onChange={(status) => store.modules.update(module.id, { status })}
          />
        </span>
        {(lead || members.length > 0) && (
          <span
            role="img"
            aria-label={[
              lead && `Lead: ${lead.name}`,
              members.length > 0 && `Members: ${members.map((member) => member.name).join(", ")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            className="flex items-center gap-1.5"
          >
            {lead && <UserAvatar user={lead} size={18} />}
            {lead && members.length > 0 && <span className="h-3 w-px bg-border" />}
            <MemberStack members={members} />
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <CalendarIcon className="size-3.5" />
          {range ?? "No dates"}
        </span>
      </div>
    </li>
  );
}

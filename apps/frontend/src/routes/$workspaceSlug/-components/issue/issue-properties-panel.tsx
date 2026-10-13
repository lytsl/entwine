import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import { Separator } from "@entwine/ui/components/ui/separator";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import {
  BoxIcon,
  CalendarClockIcon,
  CalendarIcon,
  CircleDotDashedIcon,
  ClockIcon,
  FolderIcon,
  GitForkIcon,
  IterationCcwIcon,
  SignalHighIcon,
  TagIcon,
  TriangleIcon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { dueTone, fullTime, timeAgo } from "../../../../lib/dates";
import type { IssuePatch, Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { AssigneePicker } from "../pickers/assignee-picker";
import { CyclePicker } from "../pickers/cycle-picker";
import { EstimatePicker } from "../pickers/estimate-picker";
import { LabelChips } from "../pickers/label-chips";
import { LabelPicker } from "../pickers/label-picker";
import { ModulePicker } from "../pickers/module-picker";
import { PriorityPicker } from "../pickers/priority-picker";
import { StatePicker } from "../pickers/state-picker";
import { ParentPicker } from "./parent-picker";

function PropertyRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-start gap-2">
      <div className="flex h-8 w-28 shrink-0 items-center gap-2 text-body text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

export function IssuePropertiesPanel({
  issue,
  store,
  readOnly = false,
}: {
  issue: Issue;
  store: Store;
  readOnly?: boolean;
}) {
  const set = (patch: IssuePatch) => store.issues.update(issue.id, patch);
  const labelIds = store.issues.labelsOf(issue.id);
  const project = store.projects.get(issue.projectId);
  const creator = store.members.get(issue.creatorId);
  const group = store.states.get(issue.stateId)?.group;
  return (
    <section className="flex flex-col gap-0.5" aria-label="Properties">
      <h2 className="mb-2 text-caption font-medium text-muted-foreground">Properties</h2>
      {/* A disabled fieldset disables every picker in it at once. */}
      <fieldset disabled={readOnly} className="contents">
        <PropertyRow icon={<CircleDotDashedIcon />} label="State">
          <StatePicker
            store={store}
            projectId={issue.projectId}
            value={issue.stateId}
            onChange={(stateId) => set({ stateId })}
            face="field"
          />
        </PropertyRow>
        <PropertyRow icon={<UserIcon />} label="Assignee">
          <AssigneePicker
            store={store}
            value={issue.assigneeId}
            onChange={(assigneeId) => set({ assigneeId })}
            face="field"
          />
        </PropertyRow>
        <PropertyRow icon={<SignalHighIcon />} label="Priority">
          <PriorityPicker value={issue.priority} onChange={(priority) => set({ priority })} face="field" />
        </PropertyRow>
        <PropertyRow icon={<CalendarIcon />} label="Start date">
          <DatePicker
            label="Start date"
            value={issue.startDate}
            max={issue.dueDate}
            onChange={(startDate) => set({ startDate })}
            face="field"
          />
        </PropertyRow>
        <PropertyRow icon={<CalendarClockIcon />} label="Due date">
          <DatePicker
            label="Due date"
            icon="due"
            value={issue.dueDate}
            min={issue.startDate}
            tone={dueTone(issue.dueDate, group)}
            onChange={(dueDate) => set({ dueDate })}
            face="field"
          />
        </PropertyRow>
        <PropertyRow icon={<TriangleIcon />} label="Estimate">
          <EstimatePicker value={issue.estimate} onChange={(estimate) => set({ estimate })} face="field" />
        </PropertyRow>
        <PropertyRow icon={<TagIcon />} label="Labels">
          <LabelChips store={store} labelIds={labelIds} />
          <LabelPicker
            store={store}
            selected={labelIds}
            onToggle={(labelId) => store.labels.toggle(issue.id, labelId)}
            face={labelIds.length ? "icon" : "field"}
          />
        </PropertyRow>
        <PropertyRow icon={<GitForkIcon />} label="Parent">
          <ParentPicker issue={issue} store={store} />
        </PropertyRow>
        <PropertyRow icon={<IterationCcwIcon />} label="Cycle">
          <CyclePicker
            store={store}
            projectId={issue.projectId}
            value={issue.cycleId}
            onChange={(cycleId) => set({ cycleId })}
            face="field"
          />
        </PropertyRow>
        <PropertyRow icon={<BoxIcon />} label="Modules">
          <ModulePicker
            store={store}
            projectId={issue.projectId}
            selected={store.issues.modulesOf(issue.id)}
            onToggle={(moduleId) => store.modules.toggle(issue.id, moduleId)}
            face="field"
          />
        </PropertyRow>
      </fieldset>
      <Separator className="my-2" />
      <PropertyRow icon={<FolderIcon />} label="Project">
        {project && (
          <span className="flex h-8 min-w-0 items-center gap-2 px-2 text-body">
            <ProjectIcon project={project} size={16} />
            <span className="truncate">{project.name}</span>
          </span>
        )}
      </PropertyRow>
      <PropertyRow icon={<UserPlusIcon />} label="Created by">
        <span className="flex h-8 min-w-0 items-center gap-2 px-2 text-body">
          <UserAvatar user={creator} size={18} />
          <span className="truncate">{creator?.name ?? "Unknown"}</span>
        </span>
      </PropertyRow>
      <PropertyRow icon={<ClockIcon />} label="Updated">
        <span className="flex h-8 items-center px-2 text-body text-muted-foreground" title={fullTime(issue.updatedAt)}>
          {timeAgo(issue.updatedAt)}
        </span>
      </PropertyRow>
    </section>
  );
}

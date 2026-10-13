/**
 * Each action is one transaction, so every issue changes or none does, and one undo reverts it. An action is offered
 * only when it can apply to all the selected issues.
 */
import { MAX_MUTATIONS, useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import { toast } from "@entwine/ui/components/ui/toast";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@entwine/ui/components/ui/toolbar";
import {
  ArchiveIcon,
  BoxIcon,
  CircleDotDashedIcon,
  IterationCcwIcon,
  SignalHighIcon,
  TagIcon,
  Trash2Icon,
  TriangleIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { useToday } from "../../../../../hooks/use-today";
import { archiveIssues } from "../../../../../lib/issue-actions";
import {
  assigneeOptions,
  cycleOptions,
  estimateOptions,
  labelOptions,
  moduleOptions,
  plansFrozen,
  priorityOptions,
  stateOptions,
} from "../../../../../lib/issue-options";
import type { IssuePatch, Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { Choose } from "./choose";
import { ChooseMany } from "./choose-many";

const BAR =
  "absolute bottom-4 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/10 dark:shadow-black/40";

/** The value every issue has, or undefined when they differ. */
function common<T>(issues: readonly Issue[], get: (issue: Issue) => T): T | undefined {
  const first = get(issues[0]!);
  return issues.every((issue) => get(issue) === first) ? first : undefined;
}

export function BulkBar({ issues, store, onClear }: { issues: Issue[]; store: Store; onClear(): void }) {
  const ws = useWorkspace();
  const today = useToday();
  const [deleting, setDeleting] = useState(false);
  if (issues.length === 0) return null;
  const ids = issues.map((issue) => issue.id);
  const set = (patch: IssuePatch) => void store.issues.update(ids, patch);
  // State, cycle and modules belong to one project; plans also need it active.
  const projectId = common(issues, (issue) => issue.projectId);
  const plans = projectId !== undefined && !plansFrozen(store, projectId);
  const latestStart = issues.reduce<string | null>(
    (latest, issue) => (issue.startDate && (!latest || issue.startDate > latest) ? issue.startDate : latest),
    null,
  );
  const count = `${issues.length} ${issues.length === 1 ? "issue" : "issues"}`;
  // An action is one transaction of one write per issue, and the server takes so many in one.
  if (issues.length > MAX_MUTATIONS)
    return (
      <Toolbar aria-label="Selected issues" className={BAR}>
        <span className="px-2 text-body font-medium tabular-nums">{issues.length.toLocaleString()} selected</span>
        <ToolbarButton
          render={<Button variant="ghost" size="icon-sm" className="size-7" />}
          aria-label="Clear selection"
          onClick={onClear}
        >
          <XIcon />
        </ToolbarButton>
        <ToolbarSeparator className="mx-1" />
        <span className="px-2 text-body text-muted-foreground">
          Select {MAX_MUTATIONS} issues or fewer to edit them together
        </span>
      </Toolbar>
    );
  return (
    <Toolbar aria-label="Selected issues" className={BAR}>
      <span className="px-2 text-body font-medium tabular-nums">{issues.length} selected</span>
      <ToolbarButton
        render={<Button variant="ghost" size="icon-sm" className="size-7" />}
        aria-label="Clear selection"
        onClick={onClear}
      >
        <XIcon />
      </ToolbarButton>
      <ToolbarSeparator className="mx-1" />
      {projectId !== undefined && (
        <Choose
          label="State"
          icon={<CircleDotDashedIcon />}
          options={stateOptions(store, projectId)}
          value={common(issues, (issue) => issue.stateId)}
          onChange={(stateId) => set({ stateId })}
        />
      )}
      <Choose
        label="Priority"
        icon={<SignalHighIcon />}
        options={priorityOptions()}
        value={common(issues, (issue) => issue.priority as never)}
        onChange={(priority) => set({ priority })}
      />
      <Choose
        label="Assignee"
        icon={<UserIcon />}
        options={assigneeOptions(store)}
        value={common(issues, (issue) => issue.assigneeId)}
        onChange={(assigneeId) => set({ assigneeId })}
      />
      <ChooseMany
        label="Labels"
        icon={<TagIcon />}
        options={labelOptions(store)}
        has={(labelId) => issues.every((issue) => store.issues.labelsOf(issue.id).includes(labelId))}
        onToggle={(labelId) => void store.labels.toggle(ids, labelId)}
      />
      <ToolbarButton
        render={
          <DatePicker
            label="Due date"
            icon="due"
            value={common(issues, (issue) => issue.dueDate) ?? null}
            min={latestStart}
            onChange={(dueDate) => set({ dueDate })}
          />
        }
      />
      <Choose
        label="Estimate"
        icon={<TriangleIcon />}
        options={estimateOptions()}
        value={common(issues, (issue) => issue.estimate)}
        onChange={(estimate) => set({ estimate })}
      />
      {plans && (
        <>
          <Choose
            label="Cycle"
            icon={<IterationCcwIcon />}
            options={cycleOptions(store, projectId, today)}
            value={common(issues, (issue) => issue.cycleId)}
            onChange={(cycleId) => set({ cycleId })}
          />
          <ChooseMany
            label="Modules"
            icon={<BoxIcon />}
            options={moduleOptions(store, projectId)}
            has={(moduleId) => issues.every((issue) => store.issues.inModule(moduleId, issue.id))}
            onToggle={(moduleId) => void store.modules.toggle(ids, moduleId)}
          />
        </>
      )}
      <ToolbarSeparator className="mx-1" />
      {issues.every((issue) => store.issues.canArchive(issue)) && (
        <ToolbarButton
          render={<Button variant="ghost" size="sm" className="h-7 text-body" />}
          onClick={() => archiveIssues(ws, store, issues, true)}
        >
          <ArchiveIcon />
          Archive
        </ToolbarButton>
      )}
      {issues.every((issue) => store.members.canManage(issue)) && (
        <ToolbarButton
          render={
            <Button variant="ghost" size="sm" className="h-7 text-body text-destructive hover:text-destructive" />
          }
          onClick={() => setDeleting(true)}
        >
          <Trash2Icon />
          Delete
        </ToolbarButton>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${count}?`}
          description="They are deleted for every member, with their comments, activity, relations, links and module memberships. Their sub-issues stay, without a parent."
          confirmLabel={`Delete ${count}`}
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            void store.issues.delete(ids);
            toast.success(`${count} deleted`);
            setDeleting(false);
            onClear();
          }}
        />
      )}
    </Toolbar>
  );
}

import { useWorkspace } from "@entwine/db-collection/react";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { Button } from "@entwine/ui/components/ui/button";
import { ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { useShell } from "../../../../../../hooks/use-shell";
import { fullTime, timeAgo } from "../../../../../../lib/dates";
import { archiveIssues } from "../../../../../../lib/issue-actions";
import type { Store } from "../../../../../../store";
import type { Issue } from "../../../../../../types/rows";
import { IssueLink } from "../../../../-components/issue-views/issue-link";

export function ArchivedIssueRow({ issue, store, top }: { issue: Issue; store: Store; top: number }) {
  const ws = useWorkspace();
  const shell = useShell();
  const key = store.issues.key(issue);
  const state = store.states.get(issue.stateId);
  return (
    <li
      className="group/row absolute inset-x-0 top-0 flex h-11 items-center gap-3 border-b px-4 hover:bg-accent/40"
      style={{ transform: `translateY(${top}px)` }}
    >
      <span className="w-16 shrink-0 text-caption font-medium text-muted-foreground tabular-nums">{key}</span>
      {state && (
        <span className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground">
          <StateIcon type={state.group} color={state.color} className="size-3.5!" />
          {state.name}
        </span>
      )}
      <IssueLink issue={issue} className="min-w-0 flex-1 truncate text-body" />
      <span className="shrink-0 text-caption text-muted-foreground" title={fullTime(issue.archivedAt!)}>
        Archived {timeAgo(issue.archivedAt!)}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-body"
        aria-label={`Restore ${key}`}
        onClick={() => archiveIssues(ws, store, [issue], false)}
      >
        <ArchiveRestoreIcon />
        Restore
      </Button>
      {store.members.canManage(issue) && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${key}`}
          onClick={() => shell.confirmDelete(issue.id)}
        >
          <Trash2Icon />
        </Button>
      )}
    </li>
  );
}

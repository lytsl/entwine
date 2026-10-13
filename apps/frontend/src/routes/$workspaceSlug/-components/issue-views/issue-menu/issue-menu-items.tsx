import { useWorkspace } from "@entwine/db-collection/react";
import {
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { OptionRadios } from "@entwine/ui/components/ui/option-radios";
import type { PropertyOption } from "@entwine/ui/components/ui/property-select";
import { getRouteApi, Link } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CircleDotDashedIcon,
  CopyIcon,
  CopyPlusIcon,
  ExternalLinkIcon,
  LinkIcon,
  SignalHighIcon,
  SquareArrowOutUpRightIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import { ARCHIVE_REASON } from "../../../../../constants/issue";
import { type ShortcutId } from "../../../../../constants/shortcuts";
import { useShell } from "../../../../../hooks/use-shell";
import { useSingleKeys } from "../../../../../hooks/use-single-keys";
import { archiveIssues, copyIssueKey, copyIssueLink } from "../../../../../lib/issue-actions";
import { assigneeOptions, priorityOptions, stateOptions } from "../../../../../lib/issue-options";
import { keyHint } from "../../../../../lib/shortcuts";
import type { IssuePatch, Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";

const workspaceRoute = getRouteApi("/$workspaceSlug");

/** Serves the right-click menu and the "…" button: Base UI's context menu is made of the dropdown menu's parts. */
export function IssueMenuItems({ issue, store, onDeleted }: { issue: Issue; store: Store; onDeleted?(): void }) {
  const ws = useWorkspace();
  const shell = useShell();
  const { workspaceSlug } = workspaceRoute.useParams();
  const page = { issueId: issue.id };
  const set = (patch: IssuePatch) => void store.issues.update(issue.id, patch);
  const singleKeys = useSingleKeys();
  const hint = (id: ShortcutId) => (
    <DropdownMenuShortcut aria-hidden className="tracking-normal">
      {keyHint(id, undefined, singleKeys)}
    </DropdownMenuShortcut>
  );
  const submenu = <T extends string | null>(
    label: string,
    icon: ReactNode,
    options: PropertyOption<T>[],
    value: T,
    onChange: (value: T) => void,
    shortcut: ShortcutId,
  ) => (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        {icon}
        {label}
        {hint(shortcut)}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="max-h-80 w-52">
        <OptionRadios options={options} value={value} onChange={onChange} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
  const archived = issue.archivedAt !== null;
  const archivable = store.issues.canArchive(issue);
  return (
    <>
      {/* An archived issue is read-only until it is restored. */}
      {!archived && (
        <>
          {submenu(
            "State",
            <CircleDotDashedIcon />,
            stateOptions(store, issue.projectId),
            issue.stateId,
            (stateId) => set({ stateId }),
            "state",
          )}
          {submenu(
            "Priority",
            <SignalHighIcon />,
            priorityOptions(),
            issue.priority,
            (priority) => set({ priority }),
            "priority",
          )}
          {submenu(
            "Assignee",
            <UserIcon />,
            assigneeOptions(store),
            issue.assigneeId,
            (assigneeId) => set({ assigneeId }),
            "assignee",
          )}
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuLinkItem render={<Link from="/$workspaceSlug" to="/$workspaceSlug/issues/$issueId" params={page} />}>
        <ExternalLinkIcon />
        Open
      </DropdownMenuLinkItem>
      <DropdownMenuLinkItem
        render={
          <Link
            from="/$workspaceSlug"
            to="/$workspaceSlug/issues/$issueId"
            params={page}
            target="_blank"
            rel="noopener"
          />
        }
      >
        <SquareArrowOutUpRightIcon />
        Open in new tab
      </DropdownMenuLinkItem>
      <DropdownMenuItem onClick={() => copyIssueLink(workspaceSlug, issue.id)}>
        <LinkIcon />
        Copy link
        {hint("copyLink")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => copyIssueKey(store, issue)}>
        <CopyIcon />
        Copy key
        {hint("copyKey")}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => shell.openNewIssue(store.issues.copyOf(issue))}>
        <CopyPlusIcon />
        Make a copy
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {archived ? (
        <DropdownMenuItem onClick={() => archiveIssues(ws, store, [issue], false)}>
          <ArchiveRestoreIcon />
          Restore
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem disabled={!archivable} onClick={() => archiveIssues(ws, store, [issue], true)}>
          <ArchiveIcon />
          <span className="flex flex-col">
            Archive
            {!archivable && <span className="text-caption text-muted-foreground">{ARCHIVE_REASON}</span>}
          </span>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        variant="destructive"
        disabled={!store.members.canManage(issue)}
        onClick={() => shell.confirmDelete(issue.id, onDeleted)}
      >
        <Trash2Icon />
        Delete
        {hint("delete")}
      </DropdownMenuItem>
    </>
  );
}

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BoxIcon,
  CircleDotDashedIcon,
  CopyIcon,
  CopyPlusIcon,
  IterationCcwIcon,
  LinkIcon,
  SignalHighIcon,
  TagIcon,
  Trash2Icon,
  TriangleIcon,
  UserIcon,
  UserMinusIcon,
  UserPlusIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ShortcutId } from "../../constants/shortcuts";
import type { Command, CommandContext } from "../../types/command";
import type { Issue } from "../../types/rows";
import type { Shell } from "../../types/shell";
import { archiveIssues, copyIssueKey, copyIssueLink } from "../issue-actions";
import { plansFrozen } from "../issue-options";

export function issueCommands({ ws, store, shell, workspaceSlug }: CommandContext, issue: Issue): Command[] {
  const commands: Command[] = [];
  // An archived issue is read-only until it is restored.
  if (issue.archivedAt === null) {
    const choose = (
      id: string,
      label: string,
      icon: ReactNode,
      page: Parameters<Shell["openPalette"]>[0],
      shortcut: ShortcutId,
    ) => commands.push({ id, group: "Issue", label, icon, shortcut, stays: true, run: () => shell.openPalette(page) });
    choose("issue-state", "Change state…", <CircleDotDashedIcon />, "state", "state");
    choose("issue-priority", "Change priority…", <SignalHighIcon />, "priority", "priority");
    choose("issue-assignee", "Assign to…", <UserIcon />, "assignee", "assignee");
    const mine = issue.assigneeId === ws.userId;
    commands.push({
      id: "issue-assign-me",
      group: "Issue",
      label: mine ? "Unassign from me" : "Assign to me",
      icon: mine ? <UserMinusIcon /> : <UserPlusIcon />,
      shortcut: "assignMe",
      run: () => void store.issues.assignToMe(issue),
    });
    choose("issue-labels", "Change labels…", <TagIcon />, "labels", "labels");
    choose("issue-estimate", "Change estimate…", <TriangleIcon />, "estimate", "estimate");
    if (!plansFrozen(store, issue.projectId)) {
      choose("issue-cycle", "Move to cycle…", <IterationCcwIcon />, "cycle", "cycle");
      choose("issue-modules", "Change modules…", <BoxIcon />, "modules", "modules");
    }
  }
  commands.push(
    {
      id: "issue-copy-key",
      group: "Issue",
      label: "Copy key",
      icon: <CopyIcon />,
      shortcut: "copyKey",
      run: () => copyIssueKey(store, issue),
    },
    {
      id: "issue-copy-link",
      group: "Issue",
      label: "Copy link",
      icon: <LinkIcon />,
      shortcut: "copyLink",
      run: () => copyIssueLink(workspaceSlug, issue.id),
    },
    {
      id: "issue-copy",
      group: "Issue",
      label: "Make a copy",
      icon: <CopyPlusIcon />,
      keywords: ["duplicate"],
      run: () => shell.openNewIssue(store.issues.copyOf(issue)),
    },
  );
  if (issue.archivedAt !== null)
    commands.push({
      id: "issue-restore",
      group: "Issue",
      label: "Restore issue",
      icon: <ArchiveRestoreIcon />,
      keywords: ["unarchive"],
      run: () => archiveIssues(ws, store, [issue], false),
    });
  else if (store.issues.canArchive(issue))
    commands.push({
      id: "issue-archive",
      group: "Issue",
      label: "Archive issue",
      icon: <ArchiveIcon />,
      run: () => archiveIssues(ws, store, [issue], true),
    });
  if (store.members.canManage(issue))
    commands.push({
      id: "issue-delete",
      group: "Issue",
      label: "Delete issue…",
      icon: <Trash2Icon />,
      shortcut: "delete",
      run: () => shell.confirmDelete(issue.id),
    });
  return commands;
}

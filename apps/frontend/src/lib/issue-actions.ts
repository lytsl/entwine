import type { Workspace } from "@entwine/db-collection/react";
import { toast } from "@entwine/ui/components/ui/toast";
import { type Store } from "../store";
import { type Issue } from "../types/rows";
import { copyText } from "./clipboard";
import { issueUrl } from "./url";

export const copyIssueLink = (workspaceSlug: string, issueId: string) => copyText(issueUrl(workspaceSlug, issueId));

export function archiveIssues(ws: Workspace, store: Store, issues: readonly Issue[], archived: boolean) {
  void store.issues.setArchived(
    issues.map((issue) => issue.id),
    archived,
  );
  const what = issues.length === 1 ? store.issues.key(issues[0]!) : `${issues.length} issues`;
  toast.success(`${what} ${archived ? "archived" : "restored"}`, {
    action: { label: "Undo", onClick: () => void ws.undo() },
  });
}

export function copyIssueKey(store: Store, issue: Issue) {
  const key = store.issues.key(issue);
  copyText(key, `Copied ${key}`);
}

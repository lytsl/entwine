import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { toast } from "@entwine/ui/components/ui/toast";
import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";

export function DeleteIssueDialog({
  issue,
  store,
  onClose,
  onDeleted,
}: {
  issue: Issue;
  store: Store;
  onClose(): void;
  onDeleted?(): void;
}) {
  const key = store.issues.key(issue);
  return (
    <ConfirmDialog
      title={`Delete ${key}?`}
      description={`“${issue.title}” is deleted for every member, with its comments, activity, relations, links and module memberships. Its sub-issues stay, without a parent.`}
      confirmLabel="Delete issue"
      onClose={onClose}
      onConfirm={() => {
        void store.issues.delete(issue.id);
        toast.success(`${key} deleted`);
        onClose();
        onDeleted?.();
      }}
    />
  );
}

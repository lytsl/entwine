import { useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { ArchiveIcon } from "lucide-react";
import { archiveIssues } from "../../../../lib/issue-actions";
import { type Store } from "../../../../store";
import { type Issue } from "../../../../types/rows";

export function IssueArchivedBanner({ issue, store }: { issue: Issue; store: Store }) {
  const ws = useWorkspace();
  if (issue.archivedAt === null) return null;
  return (
    <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm" role="status">
      <ArchiveIcon className="size-4 text-muted-foreground" />
      This issue is archived. Restore it to edit it.
      <Button className="ml-auto" variant="outline" size="sm" onClick={() => archiveIssues(ws, store, [issue], false)}>
        Restore
      </Button>
    </div>
  );
}

import { PageShell } from "@entwine/ui/components/ui/page-shell";
import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "../../../../hooks/use-document-title";

export function WorkspaceNotFound() {
  useDocumentTitle("Workspace not found");
  return (
    <PageShell>
      <div className="flex flex-col items-center gap-3 text-sm">
        <h1 className="text-base font-medium">Workspace not found</h1>
        <p>This workspace does not exist, or you are not a member of it.</p>
        <Link to="/" className="underline underline-offset-4">
          Go to your workspaces
        </Link>
      </div>
    </PageShell>
  );
}

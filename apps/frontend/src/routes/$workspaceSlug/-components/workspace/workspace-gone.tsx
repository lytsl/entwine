import { Button } from "@entwine/ui/components/ui/button";
import { PageShell } from "@entwine/ui/components/ui/page-shell";
import { useEffect } from "react";
import { useLeaveWorkspace } from "../../../../hooks/use-leave-workspace";
import type { WorkspaceInfo } from "../../../../services/auth-client";

/** Shown for the moment it takes to leave a workspace the member lost, and for as long as leaving fails. */
export function WorkspaceGone({ workspace }: { workspace: WorkspaceInfo }) {
  const { lost } = useLeaveWorkspace(workspace);
  // biome-ignore lint/correctness/useExhaustiveDependencies: said once, when the workspace is lost.
  useEffect(lost, []);
  return (
    <PageShell>
      <div className="flex flex-col items-center gap-3 text-sm">
        <p>This workspace is no longer open to you.</p>
        <Button onClick={() => window.location.assign("/")}>Go to your workspaces</Button>
      </div>
    </PageShell>
  );
}

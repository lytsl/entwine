import { useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useStore } from "../../../hooks/use-store";
import { SettingsPage } from "../-components/settings/settings-page";
import { SettingsSection } from "../-components/settings/settings-section";
import { DeleteWorkspaceDialog } from "./-components/delete-workspace-dialog";
import { TransferOwnership } from "./-components/transfer-ownership";
import { WorkspaceNameForm } from "./-components/workspace-name-form";

export const Route = createFileRoute("/$workspaceSlug/settings/general")({ component: GeneralPage });

function GeneralPage() {
  const { workspace } = Route.useRouteContext();
  const { userId } = useWorkspace();
  const store = useStore();
  const [deleting, setDeleting] = useState(false);
  // The shell, which this page is inside, renders only for a workspace.
  if (!workspace) return null;
  const owner = store.members.get(userId)?.role === "owner";
  return (
    <>
      <PageHeader title="General" icon={<SettingsIcon />} />
      <SettingsPage>
        <SettingsSection title="Workspace" description="The name its members see, and where it lives.">
          <div className="rounded-xl border bg-card/40 p-5">
            <WorkspaceNameForm key={workspace.name} workspace={workspace} editable={store.members.isAdmin()} />
          </div>
        </SettingsSection>
        {owner && (
          <SettingsSection title="Ownership" description="Who may delete the workspace or hand it on.">
            <TransferOwnership workspace={workspace} />
          </SettingsSection>
        )}
        {owner && (
          <SettingsSection title="Danger zone">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-destructive/30 px-5 py-4">
              <div className="flex min-w-48 flex-1 flex-col gap-0.5">
                <span className="text-body font-medium">Delete workspace</span>
                <span className="text-body text-muted-foreground">
                  Deleting removes the workspace, its projects and issues, and its members' access, for good.
                </span>
              </div>
              <Button variant="destructive" onClick={() => setDeleting(true)}>
                Delete workspace
              </Button>
            </div>
          </SettingsSection>
        )}
      </SettingsPage>
      {deleting && <DeleteWorkspaceDialog workspace={workspace} onClose={() => setDeleting(false)} />}
    </>
  );
}

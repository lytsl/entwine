import { Button } from "@entwine/ui/components/ui/button";
import { type ReactNode, useState } from "react";
import type { Store } from "../../../../../../store";
import type { Project } from "../../../../../../types/rows";
import { DeleteProjectDialog } from "./delete-project-dialog";

function DangerRow({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex items-center gap-6 px-5 py-4">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-body font-medium">{title}</span>
        <span className="text-body text-muted-foreground">{description}</span>
      </div>
      {action}
    </div>
  );
}

export function DangerZone({ project, store }: { project: Project; store: Store }) {
  const [confirming, setConfirming] = useState(false);
  const canDelete = store.members.isAdmin();
  const archived = project.archivedAt !== null;
  return (
    <div className="divide-y overflow-hidden rounded-xl border border-destructive/30">
      <DangerRow
        title={archived ? "Restore project" : "Archive project"}
        description={
          archived
            ? "Restoring brings the project back to the sidebar, pickers and My issues."
            : "An archived project leaves the sidebar, pickers and My issues, and accepts no new issues or plan changes. It can be restored."
        }
        action={
          <Button variant="outline" onClick={() => store.projects.setArchived(project.id, !archived)}>
            {archived ? "Restore project" : "Archive project"}
          </Button>
        }
      />
      <DangerRow
        title="Delete project"
        description={
          canDelete
            ? "Deleting removes the project, its states, cycles, modules and all its issues for good."
            : "Only owners and admins can delete a project."
        }
        action={
          <Button variant="destructive" disabled={!canDelete} onClick={() => setConfirming(true)}>
            Delete project
          </Button>
        }
      />
      {confirming && <DeleteProjectDialog project={project} store={store} onClose={() => setConfirming(false)} />}
    </div>
  );
}

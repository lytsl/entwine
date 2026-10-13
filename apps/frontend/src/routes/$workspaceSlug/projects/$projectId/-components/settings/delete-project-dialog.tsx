import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { Input } from "@entwine/ui/components/ui/input";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Store } from "../../../../../../store";
import type { Project } from "../../../../../../types/rows";

/** The identifier has to be typed, since everything in the project goes. */
export function DeleteProjectDialog({ project, store, onClose }: { project: Project; store: Store; onClose(): void }) {
  const navigate = useNavigate({ from: "/$workspaceSlug/projects/$projectId/settings" });
  const [typed, setTyped] = useState("");
  return (
    <ConfirmDialog
      title={`Delete ${project.name}?`}
      description={
        <>
          Its states, cycles, modules and all its issues, with their comments and activity, are deleted for every
          member. Type <strong className="text-foreground">{project.identifier}</strong> to confirm.
        </>
      }
      confirmLabel="Delete project"
      disabled={typed.trim().toUpperCase() !== project.identifier}
      onClose={onClose}
      onConfirm={() => {
        void store.projects.delete(project.id);
        void navigate({ to: "/$workspaceSlug/projects" });
      }}
    >
      <Input aria-label="Project identifier" value={typed} onChange={(event) => setTyped(event.target.value)} />
    </ConfirmDialog>
  );
}

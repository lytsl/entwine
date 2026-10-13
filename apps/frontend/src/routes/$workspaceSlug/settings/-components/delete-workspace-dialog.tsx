import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { Input } from "@entwine/ui/components/ui/input";
import { toast } from "@entwine/ui/components/ui/toast";
import { useState } from "react";
import { useLeaveWorkspace } from "../../../../hooks/use-leave-workspace";
import { errorMessage, type WorkspaceInfo } from "../../../../services/auth-client";

/** The name has to be typed, since everything in the workspace goes, for every member. */
export function DeleteWorkspaceDialog({ workspace, onClose }: { workspace: WorkspaceInfo; onClose(): void }) {
  const leave = useLeaveWorkspace(workspace);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const ready = !deleting && typed.trim() === workspace.name;
  const confirm = () => {
    setDeleting(true);
    leave.delete().catch((error) => {
      setDeleting(false);
      toast.error(errorMessage(error));
    });
  };
  return (
    <ConfirmDialog
      title={`Delete ${workspace.name}?`}
      description={
        <>
          Its projects, issues, comments and files are deleted, and every member loses the workspace, at once and for
          good. Type <strong className="text-foreground wrap-anywhere">{workspace.name}</strong> to confirm.
        </>
      }
      confirmLabel={deleting ? "Deleting…" : "Delete workspace"}
      disabled={!ready}
      onClose={onClose}
      onConfirm={confirm}
    >
      <Input
        aria-label="Workspace name"
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && ready) confirm();
        }}
      />
    </ConfirmDialog>
  );
}

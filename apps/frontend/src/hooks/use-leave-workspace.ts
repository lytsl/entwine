import { toast } from "@entwine/ui/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { lastWorkspace } from "../preferences/last-workspace";
import { authClient, type WorkspaceInfo } from "../services/auth-client";
import { workspacesQuery } from "../services/queries";

/** Workspaces this tab is deleting. It says so itself: the sync's refusal of them, which may come first, stays silent. */
const deleting = new Set<string>();

/** The two ways a tab leaves a workspace that is gone, for another of the member's workspaces or for creating one. */
export function useLeaveWorkspace(workspace: WorkspaceInfo) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const leave = async () => {
    lastWorkspace.forget(workspace.slug);
    await queryClient.invalidateQueries({ queryKey: workspacesQuery.queryKey });
    await navigate({ to: "/" });
  };
  return {
    /** The server refused the member: they were removed, or someone else deleted the workspace. */
    lost() {
      if (deleting.has(workspace.id)) return;
      toast.info(`You no longer belong to ${workspace.name}.`, {
        description: "It was deleted, or you were removed from it.",
      });
      void leave();
    },
    /** Rejects with the server's refusal, and stays. */
    async delete() {
      deleting.add(workspace.id);
      try {
        await authClient.organization.delete({ organizationId: workspace.id });
      } catch (error) {
        deleting.delete(workspace.id);
        throw error;
      }
      toast.success(`${workspace.name} was deleted`);
      await leave();
    },
  };
}

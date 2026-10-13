/**
 * What deleting an account does to its workspaces. A workspace of which it is the only member goes with it; one of
 * which it is the only owner, among others, would be left without one, so it refuses the deletion; it leaves the
 * rest. Leaving and deleting go through the workspace endpoints, as the person's own session, so every hook that
 * follows a departure or a deletion runs as it does when they are asked for one by one.
 */
import { APIError } from "better-auth/api";
import type { AccountWorkspace } from "./memberships";

/** The two endpoints of Better Auth's organization plugin it calls. */
export interface WorkspaceApi {
  deleteOrganization(input: { headers: Headers; body: { organizationId: string } }): Promise<unknown>;
  leaveOrganization(input: { headers: Headers; body: { organizationId: string } }): Promise<unknown>;
}

const quoted = (names: string[]) => {
  const all = names.map((name) => `"${name}"`);
  return all.length === 1 ? all[0] : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
};

export function accountDeletion(options: {
  accountWorkspaces(userId: string): AccountWorkspace[];
  /** Asked for when an account is deleted, after the auth database exists: the endpoints are its. */
  api(): WorkspaceApi;
  /** The account is gone; `left` are the workspaces it left, which keep its name on its work. */
  onDeleted?(user: { id: string; image?: string | null }, left: string[]): Promise<void>;
}) {
  /** From `beforeDelete` to `afterDelete` of the same account. */
  const leaving = new Map<string, string[]>();
  return {
    async beforeDelete(user: { id: string }, request?: Request) {
      const workspaces = options.accountWorkspaces(user.id);
      const blocked = workspaces.filter((w) => w.members > 1 && w.role === "owner" && w.owners === 1);
      if (blocked.length) {
        const names = blocked.map((w) => w.name);
        throw new APIError("BAD_REQUEST", {
          message: `You are the only owner of ${quoted(names)}. Transfer ${names.length === 1 ? "it" : "them"} to another member, or delete ${names.length === 1 ? "it" : "them"}, first.`,
        });
      }
      const headers = request?.headers ?? new Headers();
      const left: string[] = [];
      for (const { workspaceId, members } of workspaces) {
        const input = { headers, body: { organizationId: workspaceId } };
        if (members === 1) await options.api().deleteOrganization(input);
        else {
          await options.api().leaveOrganization(input);
          left.push(workspaceId);
        }
      }
      leaving.set(user.id, left);
    },
    async afterDelete(user: { id: string; image?: string | null }) {
      const left = leaving.get(user.id) ?? [];
      leaving.delete(user.id);
      await options.onDeleted?.(user, left);
    },
  };
}

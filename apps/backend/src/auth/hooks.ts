/**
 * What entwine adds to Better Auth's endpoints. `onMembership` is called whenever what a workspace should know
 * about one of its members may have changed, `onWorkspace` when what it should know about itself may have,
 * `onWorkspaceDeleting` before it is deleted from the auth database and `onWorkspaceDeleted` once it is gone.
 */

import { isAdmin, personName, ROLES, workspaceName, workspaceSlug } from "@entwine/shared";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import type { OrganizationOptions } from "better-auth/plugins/organization";
import type { Membership } from "./memberships";

export interface HookOptions {
  /** False once the instance has the workspaces it is run for: each new one is a file on its disk. */
  workspaceCreation?: boolean;
  onMembership?: (workspaceId: string, userId: string) => Promise<void>;
  onWorkspace?: (workspaceId: string) => Promise<void>;
  onWorkspaceDeleting?: (workspaceId: string) => Promise<void>;
  onWorkspaceDeleted?: (workspaceId: string) => Promise<void>;
  membership: (workspaceId: string, userId: string) => Membership | null;
  workspacesOf: (userId: string) => { workspaceId: string }[];
}

const checked = (schema: typeof personName | typeof workspaceSlug, value: unknown, what: string): string => {
  const result = schema.safeParse(value);
  if (!result.success) throw new APIError("BAD_REQUEST", { message: `${what}: ${result.error.issues[0].message}` });
  return result.data;
};
/** A workspace's slug is a path of the app, so the server decides which ones may exist. */
const checkSlug = (slug: unknown) => void checked(workspaceSlug, slug, "URL");
const checkRole = (role: string) => {
  if (!(ROLES as readonly string[]).includes(role)) throw new APIError("BAD_REQUEST", { message: "Unknown role" });
};

export function authHooks(options: HookOptions) {
  const { workspaceCreation, onMembership, membership, workspacesOf } = options;
  /** Hooks never fail the auth request: every workspace request repairs its caller's directory entry. */
  const changed = async (workspaceId: string, userId: string) => {
    try {
      await onMembership?.(workspaceId, userId);
    } catch (error) {
      console.error("[auth] member directory update failed; the member's next request repairs it", error);
    }
  };
  /** The same holds for the workspace's own row. */
  const renamed = async (workspaceId: string) => {
    try {
      await options.onWorkspace?.(workspaceId);
    } catch (error) {
      console.error("[auth] workspace name update failed; a member's next request repairs it", error);
    }
  };
  const manages = (workspaceId: string | null | undefined, userId: string) =>
    isAdmin(workspaceId ? membership(workspaceId, userId)?.role : undefined);

  return {
    databaseHooks: {
      user: {
        // A name is shown to every member of the person's workspaces: neither blank nor longer than a name is.
        create: { before: async (user) => ({ data: { ...user, name: checked(personName, user.name, "Name") } }) },
        update: {
          before: async (user) =>
            user.name === undefined ? undefined : { data: { ...user, name: checked(personName, user.name, "Name") } },
          after: async (user) => {
            for (const { workspaceId } of workspacesOf(user.id)) await changed(workspaceId, user.id);
          },
        },
      },
    } satisfies BetterAuthOptions["databaseHooks"],
    hooks: {
      // Pending invitations name people who have not joined: only those who may invite see them.
      before: createAuthMiddleware(async (ctx) => {
        // Whoever changes a password because it leaked expects the sessions it opened to end, whatever the client asks.
        if (ctx.path === "/change-password")
          return { context: { ...ctx, body: { ...ctx.body, revokeOtherSessions: true } } };
        // A picture is uploaded to the server: an address of the client's choosing would be loaded from anywhere by
        // every member's browser.
        if ((ctx.path === "/update-user" || ctx.path === "/sign-up/email") && ctx.body?.image !== undefined)
          throw new APIError("BAD_REQUEST", { message: "A picture is set by uploading it" });
        if (ctx.path !== "/organization/list-invitations") return;
        const session = await getSessionFromCtx(ctx);
        const workspaceId = ctx.query?.organizationId ?? session?.session.activeOrganizationId;
        if (session && !manages(workspaceId, session.user.id))
          throw new APIError("FORBIDDEN", { message: "Only an owner or admin can see invitations" });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/organization/get-full-organization") {
          const full = ctx.context.returned as { id?: string; invitations?: unknown[] } | null | undefined;
          const session = await getSessionFromCtx(ctx);
          if (full?.invitations && session && !manages(full.id, session.user.id))
            return ctx.json({ ...full, invitations: [] });
          return;
        }
        // Leaving has no organization hook; the member row is gone once the endpoint returns.
        if (ctx.path !== "/organization/leave") return;
        const left = ctx.context.returned as { organizationId?: string; userId?: string } | undefined;
        if (left?.organizationId && left.userId) await changed(left.organizationId, left.userId);
      }),
    },
    organizationHooks: {
      beforeCreateOrganization: async ({ organization }) => {
        if (workspaceCreation === false)
          throw new APIError("FORBIDDEN", { message: "Workspace creation is not allowed" });
        checkSlug(organization.slug);
        return { data: { ...organization, name: checked(workspaceName, organization.name, "Name") } };
      },
      beforeUpdateOrganization: async ({ organization }) => {
        // Links, bookmarks and invitations hold the slug.
        if (organization.slug !== undefined)
          throw new APIError("BAD_REQUEST", { message: "A workspace's URL cannot be changed" });
        if (organization.name === undefined) return;
        return { data: { ...organization, name: checked(workspaceName, organization.name, "Name") } };
      },
      beforeAddMember: async ({ member }) => checkRole(member.role),
      beforeUpdateMemberRole: async ({ newRole }) => checkRole(newRole),
      beforeCreateInvitation: async ({ invitation }) => checkRole(invitation.role),
      afterCreateOrganization: async ({ organization, user }) => {
        await changed(organization.id, user.id);
        await renamed(organization.id);
      },
      afterUpdateOrganization: async ({ organization }) => {
        if (organization) await renamed(organization.id);
      },
      beforeDeleteOrganization: async ({ organization }) => {
        await options.onWorkspaceDeleting?.(organization.id);
      },
      // The workspace is gone whatever happens here; what is left behind is deleted when the server next starts.
      afterDeleteOrganization: async ({ organization }) => {
        try {
          await options.onWorkspaceDeleted?.(organization.id);
        } catch (error) {
          console.error(`[auth] deleting the data of workspace ${organization.id} failed`, error);
        }
      },
      afterAddMember: ({ organization, member }) => changed(organization.id, member.userId),
      afterAcceptInvitation: ({ organization, member }) => changed(organization.id, member.userId),
      afterUpdateMemberRole: ({ organization, member }) => changed(organization.id, member.userId),
      afterRemoveMember: ({ organization, member }) => changed(organization.id, member.userId),
    } satisfies OrganizationOptions["organizationHooks"],
  };
}

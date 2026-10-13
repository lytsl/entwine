import type { Rows } from "@entwine/shared";
import { errorResponse, type Tenants } from "@entwine/sync-engine";
import type { MiddlewareHandler } from "hono";
import type { Auth } from "../auth/create-auth";
import { syncMember } from "../services/member-directory";
import { workspaceCaller } from "../services/workspace-caller";
import { syncWorkspace } from "../services/workspace-name";
import type { AppEnv } from "../types";

export const workspaceAccess =
  (auth: Auth, tenants: Tenants<Rows>): MiddlewareHandler<AppEnv, "/:workspaceId/*"> =>
  async (c, next) => {
    const workspaceId = c.req.param("workspaceId");
    const caller = await workspaceCaller(auth, workspaceId, c.req.raw.headers);
    if (!caller) return errorResponse(401, "unauthenticated", "Sign in to continue");
    if (!caller.membership) return errorResponse(403, "forbidden", "You are not a member of this workspace");
    // Repairs the caller's directory entry, and the workspace's name, if a hook failed.
    await syncMember(auth, tenants, workspaceId, caller.userId);
    await syncWorkspace(auth, tenants, workspaceId);
    c.set("tenant", await tenants.tenant(workspaceId));
    c.set("userId", caller.userId);
    c.set("role", caller.membership.role);
    await next();
  };

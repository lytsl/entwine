/**
 * The tenant's member directory follows the auth database: one `Member` row per user who is or was a member, so
 * issues keep naming people who left. Writing it through the tenant's writer makes it a change like any other.
 */

import type { Row, Rows } from "@entwine/shared";
import type { Tenants } from "@entwine/sync-engine";
import type { Auth } from "../auth/create-auth";

export async function syncMember(
  auth: Auth,
  tenants: Tenants<Rows>,
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!auth.workspaceExists(workspaceId)) return;
  const membership = auth.membership(workspaceId, userId);
  const tenant = await tenants.tenant(workspaceId);
  await tenant.write(async (writer) => {
    const current = await writer.get("Member", userId);
    if (!membership) {
      if (current && !current.removed) await writer.update("Member", userId, { removed: 1 });
      return;
    }
    const row: Row<"Member"> = {
      id: userId,
      name: membership.name,
      email: membership.email,
      image: membership.image,
      role: membership.role,
      removed: 0,
    };
    if (!current) await writer.insert("Member", row);
    else if ((Object.keys(row) as (keyof typeof row)[]).some((key) => row[key] !== current[key])) {
      await writer.update("Member", userId, row);
    }
  });
}

/** A deleted account's entry: its name stays on its work; its address and picture go with it. */
export async function forgetMember(tenants: Tenants<Rows>, workspaceId: string, userId: string): Promise<void> {
  const tenant = await tenants.tenant(workspaceId);
  await tenant.write(async (writer) => {
    if (await writer.get("Member", userId))
      await writer.update("Member", userId, { email: "", image: null, removed: 1 });
  });
}

/**
 * The tenant's `Workspace` row follows the auth database, as its member directory does: the stream then brings a
 * rename to every open tab.
 */

import type { Rows } from "@entwine/shared";
import type { Tenants } from "@entwine/sync-engine";
import type { Auth } from "../auth/create-auth";

export async function syncWorkspace(auth: Auth, tenants: Tenants<Rows>, workspaceId: string): Promise<void> {
  if (!auth.workspaceExists(workspaceId)) return;
  const tenant = await tenants.tenant(workspaceId);
  await tenant.write(async (writer) => {
    // Read in the tenant's turn: of two renames, the row keeps the one the auth database kept.
    const name = auth.workspace(workspaceId)?.name;
    if (name === undefined) return;
    const current = await writer.get("Workspace", workspaceId);
    if (!current) await writer.insert("Workspace", { id: workspaceId, name });
    else if (current.name !== name) await writer.update("Workspace", workspaceId, { name });
  });
}

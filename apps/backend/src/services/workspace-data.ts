import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Rows } from "@entwine/shared";
import type { Tenants } from "@entwine/sync-engine";
import { workspaceFiles } from "./files";

/**
 * A workspace's deletion spans two stores, the auth database and the server's disk, and the server may stop
 * between them. `<workspace id>.deleting` beside the tenant file says the deletion was asked for: it is written
 * before the auth database forgets the workspace and removed once the disk holds nothing of it, so the next start
 * finishes what was left. Only a workspace so marked is ever deleted from disk, whatever the auth database holds.
 */
const DELETING = /^([A-Za-z0-9_-]{1,64})\.deleting$/;
const marker = (tenantDir: string, workspaceId: string) => join(tenantDir, `${workspaceId}.deleting`);

export async function markWorkspaceDeleting(tenantDir: string, workspaceId: string): Promise<void> {
  await mkdir(tenantDir, { recursive: true });
  await writeFile(marker(tenantDir, workspaceId), "");
}

/**
 * Deletes everything a workspace has on the server's disk, once the auth database no longer holds the workspace.
 * Whatever else comes to be kept per workspace is deleted here too.
 */
export async function deleteWorkspaceData(
  tenants: Tenants<Rows>,
  tenantDir: string,
  workspaceId: string,
): Promise<void> {
  try {
    // Ends the workspace's streams and removes its SQLite file.
    await tenants.delete(workspaceId);
  } finally {
    // After the tenant, whose queued writes may still read their attachments' bytes; and whether or not its file
    // could be removed, since nothing will ask for these again.
    await workspaceFiles(tenantDir, workspaceId).clear();
  }
  // The mail its notifications were waiting for.
  await rm(join(tenantDir, `${workspaceId}.mail`), { force: true });
  await rm(marker(tenantDir, workspaceId), { force: true });
}

/** At start: a marked workspace the auth database still holds was not deleted after all, and keeps its data. */
export async function finishWorkspaceDeletions(
  tenants: Tenants<Rows>,
  tenantDir: string,
  exists: (workspaceId: string) => boolean,
): Promise<void> {
  for (const name of await readdir(tenantDir).catch(() => [])) {
    const workspaceId = DELETING.exec(name)?.[1];
    if (!workspaceId) continue;
    if (exists(workspaceId)) await rm(marker(tenantDir, workspaceId), { force: true });
    else await deleteWorkspaceData(tenants, tenantDir, workspaceId);
  }
}

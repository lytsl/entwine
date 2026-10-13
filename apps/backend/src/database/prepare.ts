import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { createSqliteControlClient } from "@prisma/orm-sqlite/control";
import contractJson from "./contract.json" with { type: "json" };

/**
 * Prisma's marker holds the hashes of the contract applied last. The full check reads the whole schema and takes
 * seconds on a large file, so a file is checked once per contract.
 */
function prepared(path: string): boolean {
  if (!existsSync(path)) return false;
  const db = new Database(path, { readonly: true });
  try {
    const marker = db.query("SELECT core_hash, profile_hash FROM _prisma_marker WHERE space = 'app'").get() as {
      core_hash: string;
      profile_hash: string;
    } | null;
    return marker?.core_hash === contractJson.storage.storageHash && marker.profile_hash === contractJson.profileHash;
  } catch {
    // A file without the marker's table has never been prepared.
    return false;
  } finally {
    db.close();
  }
}

/** A destructive difference is refused. */
export async function prepareTenant(path: string): Promise<void> {
  if (prepared(path)) return;
  const control = createSqliteControlClient({ connection: path });
  try {
    const result = await control.dbUpdate({ contract: contractJson, mode: "apply", migrationsDir: dirname(path) });
    if (!result.ok) {
      throw new Error(
        `Tenant ${path} does not match the contract (${result.failure.summary}). Delete the file to rebuild it.`,
      );
    }
  } finally {
    await control.close();
  }
}

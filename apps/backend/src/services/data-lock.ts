/**
 * One process at a time may own a data directory: a second server on it would write without the first one's
 * queues and streams knowing. The owner holds an exclusive SQLite lock on a file in the directory, which the
 * system releases when the process ends, however it ends.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const LOCK_FILE = "lock";

/** Throws when another process holds the directory. Returns the release. */
export function lockData(dataDir: string): () => void {
  mkdirSync(dataDir, { recursive: true });
  const lock = new Database(join(dataDir, LOCK_FILE));
  try {
    // The journal in memory: nothing is written, and the lock stays one file.
    lock.exec("PRAGMA journal_mode = MEMORY; BEGIN EXCLUSIVE;");
  } catch (error) {
    lock.close();
    throw new Error(`Another server is using ${dataDir}: stop it first (${(error as Error).message})`);
  }
  return () => lock.close();
}

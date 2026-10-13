import { rmSync } from "node:fs";

/** Removes a test's temporary directory, once everything opened in it has been closed. */
export function removeTemp(dir: string) {
  // Windows keeps a closed SQLite file locked until its statements are garbage-collected; one the test still
  // references survives, and the directory stays.
  Bun.gc(true);
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

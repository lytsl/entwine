/**
 * The bytes of a workspace's attachments: `<tenant directory>/<workspace id>.files/<attachment id>`, beside the
 * workspace's database. A file is stored before the `Attachment` row that names it and is served only through that
 * row, so bytes without a row are unreachable; `sweep` deletes them once they have been so for a while. Beside each
 * file, `<attachment id>.by` names the member who uploaded it: only they can attach it, so the day a removed
 * attachment's bytes are kept is not a day in which another member can attach them again.
 */
import { link, mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** How long a file outlives its row: undoing the row's deletion needs the bytes. */
export const ORPHAN_MS = 24 * 60 * 60 * 1000;

const FILE_ID = /^[0-9a-f-]{36}$/i;

/** What the write rules need of a workspace's files. */
export interface WorkspaceFiles {
  /** The stored file's size in bytes; null when there is none. */
  size(id: string): Promise<number | null>;
  /** The member who uploaded the stored file; null when there is none. */
  uploader(id: string): Promise<string | null>;
  /** The file's row is being deleted: the time it is kept without one starts now. */
  release(id: string): Promise<void>;
}

export interface FileStore extends WorkspaceFiles {
  path(id: string): string;
  /** False, and nothing written, when the id already holds a file: a stored file is never replaced. */
  save(id: string, bytes: Uint8Array, uploaderId: string): Promise<boolean>;
  /** Deletes every file that is not one of `kept` and was last written or released before `before`. */
  sweep(kept: ReadonlySet<string>, before: number): Promise<void>;
  /** Deletes every file: the workspace is gone. */
  clear(): Promise<void>;
}

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";

export function workspaceFiles(tenantDir: string, workspaceId: string): FileStore {
  const dir = join(tenantDir, `${workspaceId}.files`);
  const path = (id: string) => {
    // The id becomes a file name.
    if (!FILE_ID.test(id)) throw new Error(`Invalid file id ${id}`);
    return join(dir, id);
  };
  return {
    path,
    async size(id) {
      try {
        return (await stat(path(id))).size;
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async uploader(id) {
      try {
        return await readFile(`${path(id)}.by`, "utf8");
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },
    async release(id) {
      const now = new Date();
      for (const file of [path(id), `${path(id)}.by`])
        await utimes(file, now, now).catch((error) => {
          if (!missing(error)) throw error;
        });
    },
    async save(id, bytes, uploaderId) {
      const target = path(id);
      await mkdir(dir, { recursive: true });
      // Written whole under another name, then linked: a reader never sees half a file, and a taken id fails.
      const part = join(dir, `${crypto.randomUUID()}.part`);
      await writeFile(part, bytes);
      try {
        await link(part, target);
        // After the id is taken: a file left without this by a crash is attached by nobody, and swept.
        await writeFile(`${target}.by`, uploaderId);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
        throw error;
      } finally {
        await rm(part, { force: true });
      }
    },
    async sweep(kept, before) {
      const names = await readdir(dir).catch((error) => {
        if (missing(error)) return [];
        throw error;
      });
      for (const name of names) {
        if (kept.has(name.replace(/\.by$/, ""))) continue;
        const file = join(dir, name);
        const written = await stat(file).then(
          (s) => s.mtimeMs,
          () => Number.POSITIVE_INFINITY,
        );
        if (written < before) await rm(file, { force: true });
      }
    },
    async clear() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

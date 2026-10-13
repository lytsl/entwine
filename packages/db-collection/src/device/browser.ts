/** The device store in a browser: a cooperative OPFS SQLite file per member and workspace, and Web Locks. */
import { openBrowserWASQLiteOPFSDatabase } from "@tanstack/browser-db-sqlite-persistence";
import { releaseAll } from "../workspace/workspace";
import type { LocalStore, Locks } from "./local-store";
import { heldElsewhere, Store } from "./store";

const PREFIX = "entwine-";

// The database's worker ends when the page is hidden, so a page restored from the back/forward cache must reload.
window.addEventListener("pageshow", (event) => event.persisted && location.reload());

/** Hashed: wa-sqlite's OPFS file system refuses paths over 64 characters, which the two ids together exceed. */
async function baseName(userId: string, workspaceId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${workspaceId}`));
  const hex = Array.from(new Uint8Array(digest).slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${PREFIX}${hex}`;
}

const browserLocks: Locks = {
  hold(name, acquired) {
    const abort = new AbortController();
    let release = () => {};
    void navigator.locks
      .request(name, { signal: abort.signal }, async () => {
        if (abort.signal.aborted) return;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        acquired();
        await held;
      })
      .catch(() => {});
    return () => {
      abort.abort();
      release();
    };
  },
  async free(name) {
    const { held = [], pending = [] } = await navigator.locks.query();
    return ![...held, ...pending].some((lock) => lock.name === name);
  },
};

/** Retries while a reloading page's worker still holds the file: the browser frees it a moment later. */
async function openDatabase(databaseName: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await openBrowserWASQLiteOPFSDatabase({ databaseName });
    } catch (error) {
      if (attempt >= 20 || !heldElsewhere(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

/** Null without OPFS or Web Locks: the tab then keeps the workspace in memory. */
export async function openLocalStore(userId: string, workspaceId: string): Promise<LocalStore | null> {
  if (!navigator.locks || !navigator.storage?.getDirectory) return null;
  try {
    const name = await baseName(userId, workspaceId);
    const database = await openDatabase(`${name}.sqlite`);
    return {
      name,
      store: new Store(database),
      locks: browserLocks,
      close: async () => {
        await database.close?.();
      },
      destroy: () => removeStored((entry) => entry.startsWith(name)),
    };
  } catch (error) {
    console.warn("This tab keeps the workspace in memory only", error);
    return null;
  }
}

/** Covers every member and workspace; the workspaces open in this tab are released first. */
export async function clearLocalData(): Promise<void> {
  await releaseAll();
  for (const key of Object.keys(sessionStorage)) if (key.startsWith("entwine-history:")) sessionStorage.removeItem(key);
  await removeStored((name) => name.startsWith(PREFIX));
}

/** Deletes what a workspace the member left while no tab had it open, or an account that never signed out, stored. */
export async function pruneLocalData(userId: string, workspaceIds: readonly string[]): Promise<void> {
  const keep = await Promise.all(workspaceIds.map((id) => baseName(userId, id)));
  await removeStored((name) => name.startsWith(PREFIX) && !keep.some((base) => name.startsWith(base)));
}

/** An entry another tab still has open stays. */
async function removeStored(match: (name: string) => boolean): Promise<void> {
  if (!navigator.storage?.getDirectory) return;
  const root = (await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & {
    keys(): AsyncIterable<string>;
  };
  const names: string[] = [];
  for await (const name of root.keys()) if (match(name)) names.push(name);
  await Promise.all(names.map((name) => root.removeEntry(name, { recursive: true }).catch(() => {})));
  for (const { name } of (await globalThis.indexedDB?.databases?.()) ?? [])
    if (name && match(name)) indexedDB.deleteDatabase(name);
}

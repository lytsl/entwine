import { Database, type SQLQueryBindings } from "bun:sqlite";
import { type LocalStore, type Locks, type SessionStore, Store } from "@entwine/db-collection";

/**
 * A browser's storage for one member, which outlives the clients opened on it: the workspace's store over SQLite, as
 * the OPFS worker would run it, and Web Locks shared by its tabs. A client connected on it keeps the workspace;
 * connecting another one after closing the first is a reload.
 */
export interface Device {
  db: Database;
  store: Store;
  locks: Locks;
  holdWrites(): () => void;
}

export function sessionStore(): SessionStore {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/** Web Locks within one device: each name is held by the first of its queue, and passed on when released. */
function deviceLocks(): Locks {
  const queues = new Map<string, (() => void)[]>();
  return {
    hold(name, acquired) {
      const queue = queues.get(name) ?? [];
      queues.set(name, queue);
      queue.push(acquired);
      if (queue.length === 1) queueMicrotask(acquired);
      return () => {
        const index = queue.indexOf(acquired);
        if (index < 0) return;
        queue.splice(index, 1);
        if (index === 0 && queue.length) queueMicrotask(queue[0]);
      };
    },
    free: async (name) => !queues.get(name)?.length,
  };
}

export function device(): Device {
  const db = new Database(":memory:");
  let held: Promise<void> | undefined;
  const store = new Store({
    execute: async (sql, params = []) => {
      if (/^BEGIN IMMEDIATE/.test(sql) && held) await held;
      return db.query(sql).all(...(params as SQLQueryBindings[])) as Record<string, unknown>[];
    },
  });
  return {
    db,
    store,
    locks: deviceLocks(),
    holdWrites() {
      let release!: () => void;
      held = new Promise((resolve) => {
        release = resolve;
      });
      return () => {
        held = undefined;
        release();
      };
    },
  };
}

export function localStore(device: Device): LocalStore {
  const { db, store, locks } = device;
  return {
    name: "device",
    store,
    locks,
    close: async () => {},
    async destroy() {
      const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
      for (const { name } of tables) db.run(`DROP TABLE "${name}"`);
    },
  };
}

export const kept = (device: Device): number => device.db.query("SELECT id FROM outbox").all().length;

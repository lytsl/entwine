import { Database, type SQLQueryBindings } from "bun:sqlite";
import { fail } from "../errors/write-error";
import type { Schema } from "../protocol";

export const HOUR_MS = 60 * 60 * 1000;

export const quote = (name: string) => `"${name}"`;

/** bun:sqlite runs synchronously, so a long job on one tenant gives way here or the whole process waits for it. */
export const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

export interface Log {
  epoch: string;
  cursor: number;
  /** The largest pruned change id: the log holds every change after it, and a cursor below it is too old. */
  floor: number;
}

export interface Connection {
  db: Database;
  log: Log;
  /** Refuses a name that is not a model of the schema. */
  columns(model: string): Set<string>;
  /** The field a model's rows belong to one member by, if the schema names one. */
  owner(model: string): string | undefined;
}

export function openConnection(path: string, schema: Schema, retentionMs: number) {
  const db = new Database(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  try {
    db.query("SELECT id, model, rowId, data, before, txid, actorId, createdAt FROM change LIMIT 0").all();
    db.query("SELECT id FROM epoch LIMIT 0").all();
  } catch (error) {
    db.close();
    throw new Error(`Tenant ${path} lacks the engine's change and epoch tables: ${error}`);
  }
  const known = new Map<string, Set<string>>();
  const columns = (model: string) => {
    let set = known.get(model);
    if (!set) {
      if (!Object.hasOwn(schema.models, model)) fail(`${model} is not a synced model`);
      const info = db.query(`PRAGMA table_info(${quote(model)})`).all() as { name: string }[];
      if (!info.length) throw new Error(`Tenant ${path} has no table for ${model}`);
      known.set(model, (set = new Set(info.map((c) => c.name))));
    }
    return set;
  };
  let epoch = (db.query("SELECT id FROM epoch").get() as { id: string } | null)?.id;
  if (!epoch) db.query("INSERT INTO epoch (id) VALUES (?)").run((epoch = crypto.randomUUID()));
  const maxId = (where = "", ...params: SQLQueryBindings[]) =>
    (db.query(`SELECT max(id) AS id FROM change${where}`).get(...params) as { id: number | null }).id;
  const log: Log = { epoch, cursor: maxId() ?? 0, floor: 0 };
  let prunedAt = 0;
  const prune = () => {
    prunedAt = Date.now();
    // The log is in commit order, so what has expired is its oldest end: the search walks from there to the first
    // change it keeps, and costs what it drops. Asking for the newest expired change would read the whole log.
    const kept = db.query("SELECT min(id) AS id FROM change WHERE createdAt >= ?").get(prunedAt - retentionMs) as {
      id: number | null;
    };
    const last = Math.min((kept.id ?? log.cursor + 1) - 1, log.cursor - 1);
    if (last > log.floor) db.query("DELETE FROM change WHERE id <= ?").run(last);
    // Ids are consecutive, so the floor is just below the oldest change left.
    const oldest = (db.query("SELECT min(id) AS id FROM change").get() as { id: number | null }).id;
    log.floor = (oldest ?? log.cursor + 1) - 1;
  };
  prune();
  const connection: Connection = { db, log, columns, owner: (model) => schema.models[model]?.owner };
  let closed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(job: () => T | Promise<T>): Promise<T> => {
    const result = queue.then(job, job);
    queue = result.catch(() => undefined);
    return result;
  };
  return {
    connection,
    maxId,
    /** Answers undefined once the connection is closing. */
    run: <T>(job: () => T | Promise<T>) => (closed ? undefined : enqueue(job)),
    /** Runs inside a queued job. */
    pruneIfDue() {
      if (Date.now() - prunedAt >= Math.min(retentionMs, HOUR_MS)) prune();
    },
    /** Queues the close behind the jobs already queued, and refuses new ones. */
    close() {
      closed = true;
      return enqueue(() => db.close());
    },
  };
}

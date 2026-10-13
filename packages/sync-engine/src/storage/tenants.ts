/**
 * One SQLite file per tenant. The app's `prepare` creates its tables; the engine reads and writes rows by model name
 * and keeps the change log, so it knows nothing of the app's models beyond their names.
 *
 * A tenant has one connection, and every read and write of it runs through that connection's queue: SQLite takes
 * one writer, change ids must follow commit order, and a read while a transaction is open would see its uncommitted
 * rows. Committed changes are published to the tenant's subscribers, which outlive the connection so that closing an
 * idle file does not cut a live stream.
 *
 * Idle connections are evicted. A `Tenant` is only a handle: each call finds the current connection, so a request
 * that holds a handle across an eviction simply reopens the file. A file is reopened only once its old connection
 * has closed, so there is never more than one writer and the cursor read on opening is final.
 *
 * The change log keeps `retentionMs` of changes. A connection prunes older ones when it opens, and after a write
 * once as long has passed (at most an hour), so a busy tenant needs no timer. The newest change is always kept, so a
 * reopened file reads its cursor from the log and ids continue.
 *
 * A deleted tenant is refused from then on, to the handles already given out too: a request that was being served
 * must not create the file again.
 */
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { WriteError } from "../errors/write-error";
import type { Change, LoadResponse, Query, RowMap, Schema } from "../protocol";
import { appendChanges, type Batch, changesAfter, type LoggedChange, visible } from "./change-log";
import { HOUR_MS, type Log, openConnection } from "./connection";
import { loadRows } from "./load";
import { LoggingWriter, type Writer } from "./writer";

export interface Tenant<R extends RowMap = RowMap> {
  readonly id: string;
  readonly schema: Schema<R>;
  /**
   * Runs `fn` alone, in a transaction. Writes made through the writer are logged, and published once committed.
   * With a `txid` the log already holds, runs nothing and answers that transaction's last change id instead.
   */
  write<T>(
    fn: (writer: Writer<R>) => Promise<T>,
    meta?: { txid?: string; actorId?: string },
  ): Promise<{ result?: T; cursor: number }>;
  /**
   * With a `reader`, what that member may read: of a model whose rows have an owner, only their own. Without one,
   * here and below, it is the server reading, and nothing is left out.
   */
  load(queries: readonly Query[], reader?: string): Promise<LoadResponse>;
  /** Null when the log no longer holds every change after `after`. */
  changesAfter(after: number, limit?: number): Promise<Change[] | null>;
  /** `reader`'s part of the changes after `after`, and how far they were read. */
  changesFor(reader: string, after: number, limit?: number): Promise<Batch | null>;
  log(): Promise<Log>;
  /** Closes the tenant's connection; the next call opens it again. */
  close(): Promise<void>;
}

export interface Tenants<R extends RowMap = RowMap> {
  tenant(id: string): Promise<Tenant<R>>;
  /**
   * Calls `listener` with each commit of `id`, in order, until the returned function is called: the changes `reader`
   * may see, and the commit's last change id. `deleted` is called, once, if the tenant is deleted first.
   */
  subscribe(
    id: string,
    listener: (changes: Change[], cursor: number) => void,
    options?: { reader?: string; deleted?: () => void },
  ): () => void;
  /**
   * Ends the tenant: its subscribers are told, the jobs already queued finish, and its file is removed. Every later
   * call for it is refused as forbidden.
   */
  delete(id: string): Promise<void>;
  close(): Promise<void>;
}

export interface TenantsOptions<R extends RowMap> {
  dir: string;
  schema: Schema<R>;
  /**
   * Creates or updates the app's tables in a tenant file, which may not exist yet. Besides the models, the file must
   * hold the engine's `change` table (id, model, rowId, data, before, txid, actorId, createdAt) and `epoch` table (id).
   */
  prepare(path: string): Promise<void>;
  /** Connections kept open at once; the least recently used is closed beyond it. */
  maxOpen?: number;
  /** 30 days by default. */
  retentionMs?: number;
}

const RETENTION_MS = 30 * 24 * HOUR_MS;
const TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;
type Open = ReturnType<typeof openConnection>;

export function createTenants<R extends RowMap>(options: TenantsOptions<R>): Tenants<R> {
  const dir = resolve(options.dir);
  const maxOpen = options.maxOpen ?? 64;
  const retentionMs = options.retentionMs ?? RETENTION_MS;
  const { schema } = options;
  /** Opening or open connections, least recently used first. */
  const open = new Map<string, Promise<Open>>();
  /** Connections being closed, which their tenant's next opening waits for. */
  const closing = new Map<string, Promise<void>>();
  /** Each `send` gives its listener its reader's part of a commit. */
  const listeners = new Map<string, Set<{ send(open: Open, logged: LoggedChange[]): void; deleted?(): void }>>();
  /** Never emptied: an id per tenant deleted while this process runs. */
  const deleted = new Set<string>();

  function connection(id: string): Promise<Open> {
    if (deleted.has(id)) throw new WriteError("forbidden", "It was deleted");
    let current = open.get(id);
    if (current) open.delete(id);
    else {
      const path = join(dir, `${id}.db`);
      const opening = (closing.get(id) ?? Promise.resolve()).then(async () => {
        mkdirSync(dir, { recursive: true });
        await options.prepare(path);
        return openConnection(path, schema as Schema, retentionMs);
      });
      // A tenant that fails to open is not cached as broken.
      opening.catch(() => open.get(id) === opening && open.delete(id));
      current = opening;
    }
    open.set(id, current);
    while (open.size > maxOpen) closeConnection(open.keys().next().value!);
    return current;
  }

  function closeConnection(id: string): Promise<void> {
    const current = open.get(id);
    if (!current) return closing.get(id) ?? Promise.resolve();
    open.delete(id);
    const done: Promise<void> = current
      .then(
        (c) => c.close(),
        () => undefined,
      )
      .finally(() => closing.get(id) === done && closing.delete(id));
    closing.set(id, done);
    return done;
  }

  /** Reopens the tenant's connection if it was closed while the job was waiting. */
  async function run<T>(id: string, job: (open: Open) => T | Promise<T>): Promise<T> {
    for (;;) {
      const current = await connection(id);
      const result = current.run(() => job(current));
      if (result) return result;
    }
  }

  const handle = (id: string): Tenant<R> => ({
    id,
    schema,
    write: (fn, { txid, actorId } = {}) =>
      run(id, async (current) => {
        const { db, log } = current.connection;
        if (txid) {
          const applied = current.maxId(" WHERE txid = ?", txid);
          if (applied !== null) return { cursor: applied };
        }
        const writer = new LoggingWriter(current.connection, Date.now() - retentionMs);
        db.run("BEGIN IMMEDIATE");
        let logged: LoggedChange[];
        let result: Awaited<ReturnType<typeof fn>>;
        try {
          result = await fn(writer as unknown as Writer<R>);
          const createdAt = Date.now();
          logged = writer.changes.map((change, i) => ({
            ...change,
            id: log.cursor + 1 + i,
            txid: txid ?? null,
            actorId: actorId ?? null,
            createdAt,
          }));
          appendChanges(db, logged);
          db.run("COMMIT");
        } catch (error) {
          db.run("ROLLBACK");
          throw error;
        }
        if (logged.length) {
          log.cursor = logged[logged.length - 1].id;
          for (const listener of listeners.get(id) ?? []) listener.send(current, logged);
          // The write is committed and published; a failed prune only waits for the next one.
          try {
            current.pruneIfDue();
          } catch (error) {
            console.error("Pruning the change log failed", error);
          }
        }
        return { result, cursor: log.cursor };
      }),
    load: (queries, reader) => run(id, ({ connection: c }) => loadRows(c, queries, reader)),
    changesAfter: (after, limit = 1000) =>
      run(id, ({ connection: c }) => changesAfter(c, after, limit)?.changes ?? null),
    changesFor: (reader, after, limit = 1000) => run(id, ({ connection: c }) => changesAfter(c, after, limit, reader)),
    log: () => run(id, ({ connection: c }) => ({ ...c.log })),
    close: () => closeConnection(id),
  });

  return {
    async tenant(id) {
      if (!TENANT_ID.test(id)) throw new Error(`Invalid tenant id ${id}`);
      await connection(id);
      return handle(id);
    },
    subscribe(id, listener, { reader, deleted } = {}) {
      let set = listeners.get(id);
      if (!set) listeners.set(id, (set = new Set()));
      const entry = {
        send: (open: Open, logged: LoggedChange[]) =>
          listener(visible(open.connection, logged, reader), logged[logged.length - 1].id),
        deleted,
      };
      set.add(entry);
      return () => {
        set.delete(entry);
        if (!set.size) listeners.delete(id);
      };
    },
    async delete(id) {
      if (!TENANT_ID.test(id)) throw new Error(`Invalid tenant id ${id}`);
      deleted.add(id);
      for (const listener of [...(listeners.get(id) ?? [])]) listener.deleted?.();
      await closeConnection(id);
      for (const suffix of ["", "-wal", "-shm"]) rmSync(join(dir, `${id}.db${suffix}`), { force: true });
    },
    async close() {
      await Promise.all([...open.keys()].map(closeConnection));
      await Promise.all(closing.values());
    },
  };
}

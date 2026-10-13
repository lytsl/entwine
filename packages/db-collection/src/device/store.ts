/**
 * The workspace kept on the device, shared by one member's tabs.
 *
 * Every row carries its server version: the id of the change that wrote it, or the cursor of the load that read it.
 * A row is only replaced by a newer one and a deleted row stays as a version without data, so the stream, loads and
 * tabs may write in any order.
 */
import type { Database, Entry, Position, Snapshot, VersionedRow } from "../types/store";

/** Rows per transaction of a load, so kept writes and other tabs get their turn in between. */
const LOAD_ROWS = 1000;

/** SQLite's own lock, or OPFS's one access handle per file, which a closed tab keeps until its worker ends. */
export const heldElsewhere = (error: unknown): boolean =>
  /busy|locked|Access Handle|NoModificationAllowed/i.test(String(error));

export class Store {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly database: Database) {}

  /** Another tab may hold the file for a moment; wait for it. */
  private async execute(sql: string, params: readonly unknown[] = []) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.execute(sql, params);
      } catch (error) {
        if (attempt >= 30 || !heldElsewhere(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(200, 10 * (attempt + 1))));
      }
    }
  }
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
  /** A read takes no write lock, so it never waits for another tab's write. */
  private transaction<T>(fn: () => Promise<T>, write = true): Promise<T> {
    return this.run(async () => {
      await this.execute(write ? "BEGIN IMMEDIATE" : "BEGIN");
      try {
        const result = await fn();
        await this.execute("COMMIT");
        return result;
      } catch (error) {
        await this.execute("ROLLBACK").catch(() => {});
        throw error;
      }
    });
  }
  private async readPosition(): Promise<Position | undefined> {
    const [row] = await this.execute("SELECT value FROM meta WHERE key = 'position'");
    return row && JSON.parse(String(row.value));
  }
  private async upsert(rows: readonly VersionedRow[]) {
    if (!rows.length) return;
    await this.execute(
      `INSERT INTO row (model, id, version, data)
       SELECT json_extract(value, '$.model'), json_extract(value, '$.id'), json_extract(value, '$.version'),
         json_extract(value, '$.data') FROM json_each(?) WHERE true
       ON CONFLICT (model, id) DO UPDATE SET version = excluded.version, data = excluded.data
       WHERE excluded.version > row.version`,
      [JSON.stringify(rows)],
    );
  }

  /** Undefined before the first bootstrap is stored. */
  position(): Promise<Position | undefined> {
    return this.transaction(() => this.readPosition(), false);
  }

  init(): Promise<void> {
    return this.transaction(async () => {
      await this.execute(
        "CREATE TABLE IF NOT EXISTS row (model TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT, PRIMARY KEY (model, id))",
      );
      await this.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
      await this.execute(
        "CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL, body TEXT NOT NULL)",
      );
    });
  }

  /** Undefined before the first bootstrap is stored. */
  read(): Promise<Snapshot | undefined> {
    return this.transaction(async () => {
      if (!(await this.execute("SELECT name FROM sqlite_master WHERE name = 'meta'")).length) return;
      const position = await this.readPosition();
      if (!position) return;
      const rows = await this.execute("SELECT model, id, version, data FROM row");
      const loaded = await this.execute("SELECT key FROM meta WHERE key LIKE 'loaded:%'");
      return {
        position,
        rows: rows.map((r) => ({
          model: String(r.model),
          id: String(r.id),
          version: Number(r.version),
          data: r.data == null ? null : JSON.parse(String(r.data)),
        })),
        loaded: loaded.map((r) => String(r.key).slice("loaded:".length)),
      };
    }, false);
  }

  /** Replaces every row and query; the outbox stays. */
  reset(position: Position, rows: readonly VersionedRow[]): Promise<void> {
    return this.transaction(async () => {
      await this.execute("DELETE FROM row");
      await this.execute("DELETE FROM meta");
      await this.upsert(rows);
      await this.execute("INSERT INTO meta (key, value) VALUES ('position', ?)", [JSON.stringify(position)]);
    });
  }

  /**
   * Answers false, writing nothing, when the stored rows belong to another log or lack changes before `from`: the
   * position would claim what is not stored.
   */
  commit(position: Position, from: number, rows: readonly VersionedRow[]): Promise<boolean> {
    return this.transaction(async () => {
      const stored = await this.readPosition();
      if (!stored || stored.schema !== position.schema || stored.epoch !== position.epoch || from > stored.cursor)
        return false;
      await this.upsert(rows);
      const cursor = Math.max(stored.cursor, position.cursor);
      await this.execute("UPDATE meta SET value = ? WHERE key = 'position'", [JSON.stringify({ ...stored, cursor })]);
      return true;
    });
  }

  /**
   * Skipped when the stored rows belong to another log. A large load is written in pieces and its queries count as
   * stored only after the last: rows are versioned, so pieces a closed tab left behind are just written again.
   */
  async load(
    position: Omit<Position, "cursor">,
    rows: readonly VersionedRow[],
    keys: readonly string[],
  ): Promise<void> {
    const write = (fn: () => Promise<void>) =>
      this.transaction(async () => {
        const stored = await this.readPosition();
        if (stored?.schema !== position.schema || stored.epoch !== position.epoch) return false;
        await fn();
        return true;
      });
    for (let at = 0; at < rows.length; at += LOAD_ROWS)
      if (!(await write(() => this.upsert(rows.slice(at, at + LOAD_ROWS))))) return;
    await write(async () => {
      for (const key of keys)
        await this.execute("INSERT OR IGNORE INTO meta (key, value) VALUES (?, '')", [`loaded:${key}`]);
    });
  }

  add(entry: Entry, owner: string): Promise<void> {
    return this.run(async () => {
      await this.execute("INSERT OR IGNORE INTO outbox (id, owner, body) VALUES (?, ?, ?)", [
        entry.request.id,
        owner,
        JSON.stringify(entry),
      ]);
    });
  }
  remove(id: string): Promise<void> {
    return this.run(async () => {
      await this.execute("DELETE FROM outbox WHERE id = ?", [id]);
    });
  }
  /** Tabs that kept transactions here. */
  owners(): Promise<string[]> {
    return this.run(async () => (await this.execute("SELECT DISTINCT owner FROM outbox")).map((r) => String(r.owner)));
  }
  /** Hands `owner`'s transactions to `to`, in the order they were made. */
  adopt(owner: string, to: string): Promise<Entry[]> {
    return this.transaction(async () => {
      const rows = await this.execute("SELECT body FROM outbox WHERE owner = ? ORDER BY seq", [owner]);
      await this.execute("UPDATE outbox SET owner = ? WHERE owner = ?", [to, owner]);
      return rows.map((r) => JSON.parse(String(r.body)) as Entry);
    });
  }
}

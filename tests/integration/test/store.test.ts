/** The device store: rows kept by server version, the position they are complete up to, and the outbox. */
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Entry, Store, type VersionedRow } from "@entwine/db-collection";

const store = (db: Database) =>
  new Store({ execute: async (sql, params = []) => db.query(sql).all(...(params as SQLQueryBindings[])) as never });

const position = { schema: "s1", epoch: "e1", cursor: 10 };
const row = (id: string, version: number, title: string | null = id): VersionedRow => ({
  model: "Note",
  id,
  version,
  data: title === null ? null : ({ id, title } as never),
});
const titles = async (s: Store) =>
  Object.fromEntries(
    ((await s.read())?.rows ?? []).map((r) => [r.id, r.data ? (r.data as never as { title: string }).title : null]),
  );
const entry = (id: string): Entry => ({ request: { id, mutations: [] }, mutations: [] });

test("a row is only replaced by a newer version, and a delete is kept as one", async () => {
  const s = store(new Database(":memory:"));
  await s.init();
  expect(await s.read()).toBeUndefined();
  await s.reset(position, [row("a", 10), row("b", 10)]);
  expect(await s.commit({ ...position, cursor: 12 }, 10, [row("a", 11, "a2"), row("b", 12, null)])).toBe(true);
  // A load read at cursor 10 is older than both changes: it neither reverts the edit nor brings back the delete.
  await s.load(position, [row("a", 10, "stale"), row("b", 10, "stale"), row("c", 10)], ['{"model":"Note"}']);
  expect(await titles(s)).toEqual({ a: "a2", b: null, c: "c" });
  expect(await s.read()).toMatchObject({ position: { cursor: 12 }, loaded: ['{"model":"Note"}'] });
});

test("the position never claims changes the store lacks, nor rows of another log", async () => {
  const s = store(new Database(":memory:"));
  await s.init();
  await s.reset(position, []);
  // Changes after 11 cannot follow a store at 10: whatever 11 changed would be missing.
  expect(await s.commit({ ...position, cursor: 13 }, 11, [row("a", 13)])).toBe(false);
  expect(await s.commit({ ...position, epoch: "e2", cursor: 11 }, 10, [row("a", 11)])).toBe(false);
  await s.load({ schema: "s1", epoch: "e2" }, [row("b", 20)], ["key"]);
  expect(await s.read()).toEqual({ position, rows: [], loaded: [] });
  // Changes the store has already are rewritten harmlessly, and the position keeps the furthest cursor.
  expect(await s.commit({ ...position, cursor: 11 }, 9, [row("a", 11)])).toBe(true);
  expect(await s.commit({ ...position, cursor: 10 }, 9, [row("a", 10, "older")])).toBe(true);
  expect(await s.read()).toMatchObject({ position: { cursor: 11 }, rows: [row("a", 11)] });
});

test("a reset replaces rows and loaded queries but keeps the outbox, which tabs hand over in order", async () => {
  const s = store(new Database(":memory:"));
  await s.init();
  await s.reset(position, [row("a", 10)]);
  await s.load(position, [], ["key"]);
  await s.add(entry("one"), "tab1");
  await s.add(entry("two"), "tab2");
  await s.add(entry("three"), "tab1");
  await s.add(entry("one"), "tab1");
  await s.reset({ ...position, epoch: "e2" }, [row("b", 5)]);
  expect(await s.read()).toEqual({ position: { ...position, epoch: "e2" }, rows: [row("b", 5)], loaded: [] });
  expect((await s.owners()).sort()).toEqual(["tab1", "tab2"]);
  expect((await s.adopt("tab1", "tab3")).map((e) => e.request.id)).toEqual(["one", "three"]);
  expect(await s.adopt("tab1", "tab3")).toEqual([]);
  await s.remove("one");
  expect((await s.adopt("tab3", "tab4")).map((e) => e.request.id)).toEqual(["three"]);
});

test("the store waits for another tab's write, and reads without waiting for one", async () => {
  const dir = mkdtempSync(join(tmpdir(), "entwine-store-"));
  const path = join(dir, "device.db");
  const db = new Database(path);
  const other = new Database(path);
  const s = store(db);
  try {
    await s.init();
    await s.reset(position, [row("a", 10)]);
    other.run("BEGIN IMMEDIATE");
    const writing = s.commit({ ...position, cursor: 11 }, 10, [row("a", 11, "a2")]);
    setTimeout(() => other.run("COMMIT"), 30);
    expect(await writing).toBe(true);
    other.run("BEGIN IMMEDIATE");
    expect((await s.position())?.cursor).toBe(11);
    other.run("COMMIT");
  } finally {
    db.close();
    other.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the store waits for a closed tab's hold on the file, so its kept transactions are handed over", async () => {
  const db = new Database(":memory:");
  const held = store(db);
  await held.init();
  await held.add(entry("t1"), "closed-tab");
  // Chrome's words while the closed tab's worker has not ended: OPFS allows one access handle per file.
  let refusals = 2;
  const waiting = new Store({
    execute: async (sql, params = []) => {
      if (refusals-- > 0)
        throw new Error("Access Handles cannot be created if there is another open Access Handle for the file.");
      return db.query(sql).all(...(params as SQLQueryBindings[])) as never;
    },
  });
  expect(await waiting.owners()).toEqual(["closed-tab"]);
  expect((await waiting.adopt("closed-tab", "leader")).map((e) => e.request.id)).toEqual(["t1"]);
});

test("a kept write does not wait for a large load to be stored, whose queries count only once it all is", async () => {
  const db = new Database(":memory:");
  const order: string[] = [];
  const s = new Store({
    execute: async (sql, params = []) => {
      // A device takes its time over every statement.
      await new Promise((resolve) => setTimeout(resolve, 1));
      if (sql.startsWith("INSERT INTO row")) order.push("rows");
      if (sql.startsWith("INSERT OR IGNORE INTO outbox")) order.push("outbox");
      if (sql.includes("loaded:") || String(params[0]).startsWith("loaded:")) order.push("loaded");
      return db.query(sql).all(...(params as SQLQueryBindings[])) as never;
    },
  });
  await s.init();
  await s.reset(position, []);
  const rows = Array.from({ length: 2500 }, (_, i) => row(`r${i}`, 10));
  const loading = s.load(position, rows, ["key"]);
  // Asked for while the load's first piece is being written.
  await new Promise((resolve) => setTimeout(resolve, 3));
  await s.add(entry("one"), "tab1");
  await loading;
  expect(order.indexOf("outbox")).toBeLessThan(order.lastIndexOf("rows"));
  expect(order.at(-1)).toBe("loaded");
  expect(await s.read()).toMatchObject({ loaded: ["key"] });
  expect((await s.read())?.rows.length).toBe(2500);
});

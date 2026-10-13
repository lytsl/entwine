import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { compile } from "../../src/storage/query";
import { type Fixture, fixture } from "../helpers/fixture";
import { note } from "../helpers/toy";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const ids = (rows: { id: string }[] = []) => rows.map((r) => r.id).sort();

describe("loading", () => {
  beforeEach(async () => {
    await f.tenant.write(async (w) => {
      await w.insert("Note", { ...note("n3"), done: 1 });
      await w.insert("List", { id: "l3", name: "Empty" });
    });
  });

  test("answers each query's rows, merged per model, and the position they are complete up to", async () => {
    const loaded = await f.tenant.load([{ model: "List" }, { model: "Note", where: { listId: "l1" } }]);
    expect(loaded).toMatchObject({ epoch: (await f.tenant.log()).epoch, cursor: 6 });
    expect(ids(loaded.rows.List)).toEqual(["l1", "l2", "l3"]);
    expect(ids(loaded.rows.Note)).toEqual(["n1", "n3"]);
    const merged = await f.tenant.load([
      { model: "Note", where: { done: 1 } },
      { model: "Note", where: { id: ["n1", "n2"] } },
    ]);
    expect(ids(merged.rows.Note)).toEqual(["n1", "n2", "n3"]);
  });

  test("matches a value, several values, null, or the values another query selects", async () => {
    const load = async (where: object) => ids((await f.tenant.load([{ model: "Note", where } as never])).rows.Note);
    expect(await load({ listId: "l2" })).toEqual(["n2"]);
    expect(await load({ listId: ["l1", "l2"], done: 0 })).toEqual(["n1", "n2"]);
    expect(await load({ listId: [] })).toEqual([]);
    expect(await load({ listId: { model: "List", select: "id", where: { name: "Two" } } })).toEqual(["n2"]);
    const lists = await f.tenant.load([{ model: "List", where: { id: { model: "Note", select: "listId" } } }]);
    expect(ids(lists.rows.List)).toEqual(["l1", "l2"]);
    const nothing = await f.tenant.load([{ model: "List", where: { name: null } }]);
    expect(nothing.rows.List).toEqual([]);
  });

  test("refuses models outside the schema, unknown fields, deep nesting and odd values", async () => {
    const refused = (query: object) => expect(f.tenant.load([query as never])).rejects.toThrow();
    await refused({ model: "change" });
    await refused({ model: "epoch" });
    await refused({ model: "Note", where: { "listId = listId OR 1": "x" } });
    await refused({ model: "Note", where: { listId: { model: "List", where: {} } } });
    await refused({ model: "Note", where: { listId: { a: 1 } } });
    await refused({ model: "Note", where: { done: true } });
    let deep: object = { model: "List", select: "id" };
    for (let i = 0; i < 4; i++) deep = { model: "List", select: "id", where: { id: deep } };
    await refused({ model: "Note", where: { listId: deep } });
  });
});

test("a query repeated in a load is read once, and its rows answered once", async () => {
  const loaded = await f.tenant.load(Array.from({ length: 30 }, () => ({ model: "Note" })));
  expect(ids(loaded.rows.Note)).toEqual(["n1", "n2"]);
});

test("a search finds the rows whose field holds every word, in any case, up to a limit", async () => {
  await f.tenant.write(async (w) => {
    await w.insert("Note", note("s1", "l1", "Fix the broken footer links"));
    await w.insert("Note", note("s2", "l1", "Footer: 100%_done"));
    await w.insert("Note", note("s3", "l2", "broken header"));
  });
  const find = async (contains: string[], limit?: number) =>
    ids((await f.tenant.load([{ model: "Note", where: { body: { contains } }, limit }])).rows.Note);
  expect(await find(["FOOTER"])).toEqual(["s1", "s2"]);
  expect(await find(["footer", "broken"])).toEqual(["s1"]);
  // LIKE's own wildcards are searched for as written.
  expect(await find(["%_"])).toEqual(["s2"]);
  expect(await find(["_"])).toEqual(["s2"]);
  expect((await find(["o"], 2)).length).toBe(2);
  await expect(f.tenant.load([{ model: "Note", where: { body: { contains: [] } } }])).rejects.toThrow("words");
  await expect(f.tenant.load([{ model: "Note", limit: 0 }])).rejects.toThrow("limit");
});

describe("part of a model's rows", () => {
  beforeEach(async () => {
    await f.tenant.write(async (w) => {
      await w.insert("Note", { ...note("a", "l1", "low"), done: 1 });
      await w.insert("Note", note("b", "l2", "high"));
      await w.insert("Note", note("c", "l2", "mid"));
    });
  });
  const load = async (query: object) => (await f.tenant.load([{ model: "Note", ...query } as never])).rows.Note ?? [];
  const inOrder = async (query: object) => (await load(query)).map((row) => row.id);

  test("in an order, ranked or by value, a limit at a time", async () => {
    expect(await inOrder({ order: [{ field: "done", desc: true }, { field: "id" }] })).toEqual([
      "a",
      "b",
      "c",
      "n1",
      "n2",
    ]);
    const ranked = {
      order: [
        { field: "body", rank: ["high", "mid", "low"] },
        { field: "id", desc: true },
      ],
    };
    expect(await inOrder(ranked)).toEqual(["b", "c", "a", "n2", "n1"]);
    expect(await inOrder({ ...ranked, limit: 2, offset: 1 })).toEqual(["c", "a"]);
    expect(await inOrder({ ...ranked, limit: 2, offset: 4 })).toEqual(["n1"]);
    // A nested selection takes its part too.
    const lists = await f.tenant.load([
      { model: "List", where: { id: { model: "Note", select: "listId", ...ranked, limit: 2 } } },
    ]);
    expect(ids(lists.rows.List)).toEqual(["l2"]);
  });

  test("nulls come last in either direction", () => {
    const connection = { columns: () => new Set(["id", "at"]), owner: () => undefined } as never;
    const sql = (order: object) => compile(connection, { model: "gap", order: [order] } as never, []);
    expect(sql({ field: "at" })).toEndWith('ORDER BY "at" IS NULL, "at"');
    expect(sql({ field: "at", desc: true })).toEndWith('ORDER BY "at" IS NULL, "at" DESC');
  });

  test("a range, a value or none, one of several alternatives, and none of a selection", async () => {
    expect(ids(await load({ where: { body: { from: "high", to: "low" } } }))).toEqual(["a", "b"]);
    expect(ids(await load({ where: { body: { from: "mid" } } }))).toEqual(["c", "n1", "n2"]);
    expect(ids(await load({ where: { listId: ["l2", null] } }))).toEqual(["b", "c", "n2"]);
    expect(ids(await load({ where: { done: 0 }, any: [[{ body: "mid" }, { listId: "l1" }]] }))).toEqual(["c", "n1"]);
    expect(
      ids(
        await load({
          any: [
            [{ body: "mid" }, { listId: "l1" }],
            [{ done: 1 }, { id: "c" }],
          ],
        }),
      ),
    ).toEqual(["a", "c"]);
    const done = { model: "Note", select: "listId", where: { done: 1 } };
    const lists = await f.tenant.load([{ model: "List", where: { id: { not: done } } }]);
    expect(ids(lists.rows.List)).toEqual(["l2"]);
  });

  test("counts in place of the rows, per value of the counted fields", async () => {
    const loaded = await f.tenant.load([
      { model: "Note", count: ["listId", "done"] },
      { model: "Note", where: { listId: "l2" }, count: [] },
      { model: "Note", count: ["listId", "done"] },
      { model: "List" },
    ]);
    const byList = [
      { values: ["l1", 0], count: 1 },
      { values: ["l1", 1], count: 1 },
      { values: ["l2", 0], count: 3 },
    ];
    expect(loaded.counts?.[0]).toEqual(byList);
    expect(loaded.counts?.[1]).toEqual([{ values: [], count: 3 }]);
    expect(loaded.counts?.[2]).toEqual(byList);
    expect(loaded.rows.Note).toBeUndefined();
    expect(ids(loaded.rows.List)).toEqual(["l1", "l2"]);
    expect((await f.tenant.load([{ model: "List" }])).counts).toBeUndefined();
  });

  test("refuses what it cannot answer", async () => {
    const refused = (query: object) => expect(load(query)).rejects.toThrow();
    await refused({ offset: 1 });
    await refused({ limit: 1, offset: -1 });
    await refused({ order: [{ field: "nope" }] });
    await refused({ order: [{ field: "id", rank: [{}] }] });
    await refused({ count: ["nope"] });
    await refused({ count: [], limit: 1 });
    await refused({ where: { body: { from: null } } });
    await refused({ where: { body: { from: "a", nope: 1 } } });
    await refused({ where: { listId: { not: { model: "List" } } } });
    await refused({ any: [[]] });
    await refused({ any: [[{}]] });
    await refused({ any: "x" });
  });
});

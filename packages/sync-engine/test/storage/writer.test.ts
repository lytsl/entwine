import { afterEach, beforeEach, expect, test } from "bun:test";
import { collect, type Fixture, fixture } from "../helpers/fixture";
import { note } from "../helpers/toy";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

test("a fresh tenant logs every write in order, with the whole row", async () => {
  const changes = (await f.tenant.changesAfter(0))!;
  expect(changes.map((c) => [c.id, c.model, c.rowId, c.inserted])).toEqual([
    [1, "List", "l1", true],
    [2, "List", "l2", true],
    [3, "Note", "n1", true],
    [4, "Note", "n2", true],
  ]);
  expect(changes[2].data).toEqual(note("n1"));
});

test("updates log the whole row, deletes log null, and the log keeps what they replaced", async () => {
  await f.tenant.write(
    async (w) => {
      await w.update("Note", "n1", { done: 1 });
      await w.delete("Note", "n2");
    },
    { txid: "tx", actorId: "ada" },
  );
  const [updated, deleted] = (await f.tenant.changesAfter(4))!;
  expect(updated as object).toEqual({
    id: 5,
    model: "Note",
    rowId: "n1",
    data: { ...note("n1"), done: 1 },
    inserted: false,
  });
  expect(deleted).toEqual({ id: 6, model: "Note", rowId: "n2", data: null, inserted: false });
  await f.tenant.write(async (w) => {
    const logged = await w.changesOf("tx");
    expect(logged.map((c) => [c.before, c.actorId, c.txid])).toEqual([
      [note("n1"), "ada", "tx"],
      [note("n2", "l2"), "ada", "tx"],
    ]);
  });
});

test("a failed write logs and publishes nothing", async () => {
  const sub = collect(f.tenants);
  await expect(
    f.tenant.write(async (w) => {
      await w.update("Note", "n1", { done: 1 });
      throw new Error("boom");
    }),
  ).rejects.toThrow("boom");
  expect(await f.tenant.changesAfter(4)).toEqual([]);
  expect(sub.changes).toEqual([]);
  expect((await f.tenant.load([{ model: "Note", where: { id: "n1" } }])).rows.Note).toEqual([note("n1")]);
});

test("the file keeps its references: a row naming a missing one is refused", async () => {
  await expect(f.tenant.write((w) => w.insert("Note", note("n3", "missing")))).rejects.toThrow(/constraint/i);
});

test("a write names only the model's fields", async () => {
  await expect(f.tenant.write((w) => w.update("Note", "n1", { "done = 1; --": 1 } as never))).rejects.toThrow(
    "Note has no field done = 1; --",
  );
});

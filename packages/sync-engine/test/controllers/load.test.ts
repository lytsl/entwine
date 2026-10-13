import { afterEach, beforeEach, expect, test } from "bun:test";
import { load } from "../../src";
import { type Fixture, fixture } from "../helpers/fixture";
import { memo, note } from "../helpers/toy";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

test("a load answers rows, and refuses a bad query as invalid", async () => {
  const ok = await load(f.tenant, { queries: [{ model: "Note", where: { listId: "l2" } }] }, "ada");
  expect(((await ok.json()) as { rows: object }).rows).toEqual({ Note: [note("n2", "l2")] });
  for (const body of [null, {}, { queries: [{ model: "Nope" }] }, { queries: [null] }]) {
    const response = await load(f.tenant, body, "ada");
    expect(response.status).toBe(400);
  }
});

test("a load reads only the reader's own rows of a model that has an owner, whatever it asks", async () => {
  await f.tenant.write(async (w) => {
    await w.insert("Memo", memo("a1", "ada"));
    await w.insert("Memo", memo("b1", "bob", "l2"));
  });
  const rows = async (reader: string, ...queries: object[]) =>
    ((await (await load(f.tenant, { queries }, reader)).json()) as { rows: Record<string, { id: string }[]> }).rows;
  const hostile = [
    { model: "Memo" },
    { model: "Memo", where: { memberId: "bob" } },
    { model: "Memo", where: { memberId: ["ada", "bob"] } },
    { model: "Memo", where: { id: "b1" } },
    { model: "Memo", where: { text: { contains: ["b"] } }, limit: 5 },
    { model: "Memo", where: { id: { model: "Memo", select: "id", where: { memberId: "bob" } } } },
  ];
  for (const query of hostile) expect((await rows("ada", query)).Memo.filter((m) => m.id !== "a1")).toEqual([]);
  expect((await rows("bob", { model: "Memo" })).Memo).toEqual([memo("b1", "bob", "l2")]);
  expect((await rows("eve", { model: "Memo" })).Memo).toEqual([]);
  // A nested selection is the reader's own too: it cannot show which list another member's memo is in.
  const nested = { model: "List", where: { id: { model: "Memo", select: "listId" } } };
  expect((await rows("ada", nested)).List.map((l) => l.id)).toEqual(["l1"]);
  expect((await rows("eve", nested)).List).toEqual([]);
  // The server itself reads every row.
  expect((await f.tenant.load([{ model: "Memo" }])).rows.Memo).toHaveLength(2);
});

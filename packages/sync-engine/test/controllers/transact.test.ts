import { afterEach, beforeEach, expect, test } from "bun:test";
import { type TransactionRequest, transact, WriteError, type Writer } from "../../src";
import { type Fixture, fixture } from "../helpers/fixture";
import { memo, note, type Toy } from "../helpers/toy";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

/**
 * A toy app's write rules: notes and memos are inserted, updated and deleted as sent; lists are refused. A note for
 * list l2 leaves bob a memo of it, as a rule writes rows for other members.
 */
async function apply(writer: Writer<Toy>, request: TransactionRequest) {
  if (!("mutations" in request)) throw new WriteError("invalid", "Nothing to revert");
  for (const m of request.mutations) {
    if (m.model === "List") throw new WriteError("forbidden", `Clients cannot write ${m.model}`);
    const model = m.model as "Note" | "Memo";
    if (m.type === "insert") await writer.insert(model, m.value as never);
    else if (m.type === "update") await writer.update(model, m.key, m.value);
    else await writer.delete(model, m.key);
    if (m.type === "insert" && m.value.listId === "l2") await writer.insert("Memo", memo(`about-${m.key}`, "bob"));
  }
}

const send = async (body: unknown, actorId = "ada") => {
  const response = await transact(f.tenant, body, actorId, apply);
  return { status: response.status, body: await response.json() };
};
const insert = (id: string, listId = "l1") => ({ model: "Note", type: "insert", key: id, value: note(id, listId) });

test("a transaction is applied all or nothing and answers the last change id", async () => {
  expect(await send({ id: "t1", mutations: [insert("n3"), insert("n4")] })).toEqual({
    status: 200,
    body: { cursor: 6 },
  });
  expect(await send({ id: "t2", mutations: [insert("n5"), insert("n6", "missing")] })).toMatchObject({
    status: 409,
    body: { code: "conflict" },
  });
  expect(await f.tenant.changesAfter(6)).toEqual([]);
});

test("a resent transaction is answered from the log, and the log records its actor", async () => {
  const first = await send({ id: "t1", mutations: [insert("n3")] });
  expect(await send({ id: "t1", mutations: [insert("n3")] })).toEqual(first);
  await f.tenant.write(async (w) => expect((await w.changesOf("t1"))[0].actorId).toBe("ada"));
});

test("malformed bodies, models outside the schema and refusals answer with the refusal's status", async () => {
  expect((await send({ id: "t1", mutations: [] })).status).toBe(400);
  expect((await send({ mutations: [insert("n3")] })).status).toBe(400);
  expect(await send({ id: "t1", mutations: [{ ...insert("n3"), model: "change" }] })).toMatchObject({
    status: 400,
    body: { error: "change is not a synced model" },
  });
  expect((await send({ id: "t1", mutations: [{ ...insert("l9"), model: "List" }] })).status).toBe(403);
  expect(await send({ id: "t1", revert: "t0" })).toMatchObject({ status: 400, body: { code: "invalid" } });
});

test("a row with an owner is written by its owner's client only, and another's is answered as missing", async () => {
  const write = (type: string, row: Toy["Memo"], value: object = row) => ({ model: "Memo", type, key: row.id, value });
  const mine = memo("a1", "ada");
  expect((await send({ id: "t1", mutations: [write("insert", mine)] })).status).toBe(200);
  expect(await send({ id: "t2", mutations: [write("insert", memo("b9", "bob"))] })).toMatchObject({
    status: 403,
    body: { code: "forbidden" },
  });
  for (const mutation of [write("update", mine, { text: "taken" }), write("delete", mine, {})]) {
    expect(await send({ id: crypto.randomUUID(), mutations: [mutation] }, "bob")).toMatchObject({
      status: 404,
      body: { code: "not_found" },
    });
  }
  // The owner cannot be changed, by its owner either.
  expect((await send({ id: "t3", mutations: [write("update", mine, { memberId: "bob" })] })).status).toBe(400);
  expect((await f.tenant.load([{ model: "Memo" }])).rows.Memo).toEqual([mine]);

  // A row the rules make for someone else in the same transaction is out of the sender's reach as well.
  const sneaky = [insert("n3", "l2"), write("update", memo("about-n3", "bob"), { text: "read" })];
  expect((await send({ id: "t4", mutations: sneaky })).status).toBe(404);
  expect((await send({ id: "t5", mutations: [insert("n3", "l2")] })).status).toBe(200);
  expect(
    (await send({ id: "t6", mutations: [write("update", memo("about-n3", "bob"), { text: "read" })] })).status,
  ).toBe(404);

  // Its owner writes it like any row, also one made in the same transaction.
  const own = [write("insert", memo("a2", "ada")), write("update", memo("a2", "ada"), { text: "new" })];
  expect((await send({ id: "t7", mutations: [...own, write("delete", mine, {})] })).status).toBe(200);
  expect((await f.tenant.load([{ model: "Memo" }], "ada")).rows.Memo as object[]).toEqual([
    { ...memo("a2", "ada"), text: "new" },
  ]);
});

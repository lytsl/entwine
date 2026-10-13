import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { allRows, createIssue, createProject, type Fixture, fixture, insert, remove, update } from "../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("transactions", () => {
  test("apply all or nothing and answer the last change id", async () => {
    const ok = await f.send(createProject("p1", "WEB"));
    expect(ok).toEqual({ status: 200, body: { cursor: 3 + 6 } });
    const bad = await f.send([createIssue("i1", "p1"), createIssue("i2", "missing")]);
    expect(bad.status).toBe(404);
    expect((await rows()).Issue).toEqual([]);
  });

  test("refuse malformed bodies, members, activity and unknown operations", async () => {
    expect((await f.send([])).status).toBe(400);
    expect((await f.send([update("Member", "bob", { role: "owner" })])).status).toBe(403);
    await f.send(createProject("p1", "WEB"));
    await f.send([createIssue("i1", "p1")]);
    const [activity] = (await rows()).Activity;
    expect((await f.send([remove("Activity", activity.id)])).status).toBe(403);
    expect((await f.send([remove("Member", "cy")])).status).toBe(403);
  });

  test("a transaction id is applied once; a resend answers the original cursor", async () => {
    const first = await f.send(createProject("p1", "WEB"), "ada", undefined, "tx1");
    await f.send([insert("Label", { id: "l1", name: "Bug", color: "#ff0000" })]);
    const again = await f.send(createProject("p1", "WEB"), "ada", undefined, "tx1");
    expect(again).toEqual(first);
    expect((await rows()).Project).toHaveLength(1);
    const other = await f.send(createProject("p1", "WEB"), "ada", undefined, "tx2");
    expect(other.status).toBe(409);
  });

  test("an insert whose key differs from its id, or that exists, is refused", async () => {
    await f.send(createProject("p1", "WEB"));
    expect((await f.send([{ ...createIssue("i1", "p1"), key: "other" }])).status).toBe(400);
    expect((await f.send([insert("Project", { id: "p1", name: "X", identifier: "X", description: "" })])).status).toBe(
      409,
    );
  });
});

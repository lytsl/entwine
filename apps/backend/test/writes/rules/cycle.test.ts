import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  allRows,
  createIssue,
  createProject,
  type Fixture,
  fixture,
  insert,
  remove,
  update,
} from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("cycles", () => {
  const cycle = (id: string, projectId = "p1", extra: Record<string, unknown> = {}) =>
    insert("Cycle", { id, projectId, name: `Cycle ${id}`, startDate: "2026-10-01", endDate: "2026-10-14", ...extra });
  const activityOf = async (issueId: string) =>
    (await rows()).Activity.filter((a) => a.issueId === issueId && a.field === "cycleId").map((a) => [
      a.oldValue,
      a.newValue,
    ]);

  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
  });

  test("any member creates and edits a cycle; the server owns its creator, project and timestamps", async () => {
    expect(
      (await f.send([cycle("c1", "p1", { name: "  Sprint 1 ", creatorId: "ada", createdAt: 1 })], "cy")).status,
    ).toBe(200);
    expect((await rows()).Cycle[0]).toMatchObject({ name: "Sprint 1", description: "", creatorId: "cy" });
    expect((await rows()).Cycle[0].createdAt).toBeGreaterThan(1);
    await f.send([update("Cycle", "c1", { name: "Sprint one", endDate: "2026-10-20", projectId: "p2" })], "bob");
    expect((await rows()).Cycle[0]).toMatchObject({ name: "Sprint one", endDate: "2026-10-20", projectId: "p1" });
  });

  test("dates are required, and the start is not after the end", async () => {
    expect((await f.send([cycle("c1", "p1", { endDate: undefined })])).status).toBe(400);
    expect((await f.send([cycle("c1", "p1", { startDate: "2026-10-15" })])).status).toBe(400);
    expect((await f.send([cycle("c1", "p1", { name: "" })])).status).toBe(400);
    expect((await f.send([cycle("c1", "p1", { startDate: "2026-10-14" })])).status).toBe(200);
    expect((await f.send([update("Cycle", "c1", { endDate: "2026-10-01" })])).status).toBe(400);
    expect((await f.send([update("Cycle", "c1", { startDate: null })])).status).toBe(400);
    expect((await rows()).Cycle[0]).toMatchObject({ startDate: "2026-10-14", endDate: "2026-10-14" });
  });

  test("overlapping cycles are allowed", async () => {
    expect((await f.send([cycle("c1"), cycle("c2")])).status).toBe(200);
  });

  test("an issue is in one cycle of its own project; moving it records the change", async () => {
    await f.send([cycle("a"), cycle("b"), cycle("x", "p2")]);
    await f.send([createIssue("i1", "p1", { cycleId: "a" })]);
    expect((await f.send([update("Issue", "i1", { cycleId: "b" })], "bob")).status).toBe(200);
    expect((await rows()).Issue[0].cycleId).toBe("b");
    expect(await activityOf("i1")).toEqual([
      [null, "a"],
      ["a", "b"],
    ]);
    const wrong = await f.send([update("Issue", "i1", { title: "Renamed" }), update("Issue", "i1", { cycleId: "x" })]);
    expect(wrong.status).toBe(400);
    expect((await rows()).Issue[0]).toMatchObject({ cycleId: "b", title: "Issue i1" });
    expect((await f.send([createIssue("i2", "p1", { cycleId: "missing" })])).status).toBe(400);
  });

  test("a cycle and an issue in it are created in one transaction", async () => {
    expect((await f.send([cycle("c1"), createIssue("i1", "p1", { cycleId: "c1" })])).status).toBe(200);
    expect((await rows()).Issue[0].cycleId).toBe("c1");
  });

  test("assigning a parent leaves its sub-issues out of the cycle", async () => {
    await f.send([cycle("c1"), createIssue("a", "p1"), createIssue("b", "p1", { parentId: "a" })]);
    await f.send([update("Issue", "a", { cycleId: "c1" })]);
    expect((await rows()).Issue.map((i) => [i.id, i.cycleId]).sort()).toEqual([
      ["a", "c1"],
      ["b", null],
    ]);
  });

  test("its creator or an admin deletes it; its issues stay, out of the cycle, and say so", async () => {
    await f.send([cycle("c1")], "cy");
    await f.send([createIssue("i1", "p1", { cycleId: "c1" }), createIssue("i2", "p1")]);
    expect((await f.send([remove("Cycle", "c1")], "bob")).status).toBe(403);
    expect((await f.send([remove("Cycle", "c1")], "cy")).status).toBe(200);
    const after = await rows();
    expect(after.Cycle).toEqual([]);
    expect(after.Issue.map((i) => i.cycleId)).toEqual([null, null]);
    expect(await activityOf("i1")).toEqual([
      [null, "c1"],
      ["c1", null],
    ]);
    await f.send([cycle("c2")], "cy");
    expect((await f.send([remove("Cycle", "c2")], "bob", "admin")).status).toBe(200);
  });

  test("an archived project refuses new cycles, edits and assignments, but its cycles can be deleted", async () => {
    await f.send([cycle("c1"), cycle("c2"), createIssue("i1", "p1", { cycleId: "c1" })]);
    await f.send([update("Project", "p1", { archivedAt: 1 })]);
    expect((await f.send([cycle("c3")])).status).toBe(400);
    expect((await f.send([update("Cycle", "c1", { name: "Late" })])).status).toBe(400);
    expect((await f.send([update("Issue", "i1", { cycleId: "c2" })])).status).toBe(400);
    expect((await f.send([update("Issue", "i1", { cycleId: null })])).status).toBe(400);
    expect((await f.send([update("Issue", "i1", { title: "Still editable" })])).status).toBe(200);
    expect((await f.send([remove("Cycle", "c1")])).status).toBe(200);
    expect((await rows()).Issue[0].cycleId).toBeNull();
  });

  test("deleting a project deletes its cycles", async () => {
    await f.send([cycle("c1"), cycle("x", "p2"), createIssue("i1", "p1", { cycleId: "c1" })]);
    await f.send([remove("Project", "p1")]);
    expect((await rows()).Cycle.map((c) => c.id)).toEqual(["x"]);
  });
});

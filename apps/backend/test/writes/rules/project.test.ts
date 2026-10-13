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

describe("projects", () => {
  test("identifiers are normalized and unique", async () => {
    await f.send(createProject("p1", "web"));
    expect((await rows()).Project[0].identifier).toBe("WEB");
    const taken = await f.send(createProject("p2", "WEB"));
    expect(taken).toMatchObject({ status: 409, body: { code: "conflict" } });
    expect((await f.send([update("Project", "p1", { identifier: "toolong" })])).status).toBe(400);
  });

  test("a new project's default state is Backlog, and a new default must be one of its states", async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
    expect((await rows()).Project.find((p) => p.id === "p1")).toMatchObject({
      defaultStateId: "p1:backlog",
      archivedAt: null,
    });
    expect((await f.send([update("Project", "p1", { defaultStateId: "p2:unstarted" })])).status).toBe(400);
    expect((await f.send([update("Project", "p1", { defaultStateId: "p1:unstarted" })])).status).toBe(200);
    expect((await rows()).Project.find((p) => p.id === "p1")?.defaultStateId).toBe("p1:unstarted");
  });

  test("archiving stamps the server's time and refuses new issues; restoring allows them again", async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send([createIssue("i1", "p1")]);
    const before = Date.now();
    await f.send([update("Project", "p1", { archivedAt: 1 })], "cy");
    const archivedAt = (await rows()).Project[0].archivedAt;
    expect(archivedAt).toBeGreaterThanOrEqual(before);
    expect((await f.send([createIssue("i2", "p1")])).status).toBe(400);
    expect((await f.send([update("Issue", "i1", { title: "Still editable" })])).status).toBe(200);
    await f.send([update("Project", "p1", { archivedAt: 2 })]);
    expect((await rows()).Project[0].archivedAt).toBe(archivedAt);
    await f.send([update("Project", "p1", { archivedAt: null })], "cy");
    expect((await f.send([createIssue("i2", "p1")])).status).toBe(200);
  });

  test("a cycle schedule is kept within its bounds, in a time zone the server knows", async () => {
    await f.send(createProject("p1", "WEB"));
    expect((await rows()).Project[0]).toMatchObject({
      cycleWeeks: null,
      cycleStartDay: 1,
      cycleUpcoming: 2,
      cycleRollover: 0,
      cycleTimezone: "UTC",
    });
    const schedule = {
      cycleWeeks: 3,
      cycleStartDay: 0,
      cycleUpcoming: 6,
      cycleRollover: 1,
      cycleTimezone: "Asia/Kolkata",
    };
    expect((await f.send([update("Project", "p1", schedule)], "cy")).status).toBe(200);
    for (const bad of [
      { cycleWeeks: 0 },
      { cycleWeeks: 9 },
      { cycleWeeks: 1.5 },
      { cycleStartDay: 7 },
      { cycleUpcoming: 0 },
      { cycleUpcoming: 7 },
      { cycleRollover: 2 },
      { cycleTimezone: "Mars/Base" },
    ])
      expect((await f.send([update("Project", "p1", { name: "Renamed", ...bad })])).status).toBe(400);
    expect((await rows()).Project[0]).toMatchObject({ name: "WEB", ...schedule });
    expect((await f.send([update("Project", "p1", { cycleWeeks: null })])).status).toBe(200);
    expect((await rows()).Project[0]).toMatchObject({ ...schedule, cycleWeeks: null });
  });

  test("only owners and admins delete a project, which removes every row that depends on it", async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
    await f.send([insert("Label", { id: "l1", name: "Bug", color: "#ff0000" })]);
    await f.send([createIssue("i1", "p1"), createIssue("i2", "p2")]);
    await f.send([insert("IssueLabel", { id: "i1:l1", issueId: "i1", labelId: "l1" })]);
    await f.send([insert("Comment", { id: "c1", issueId: "i1", body: "hi" })]);
    expect((await f.send([remove("Project", "p1")], "bob")).status).toBe(403);
    expect((await f.send([remove("Project", "p1")], "bob", "admin")).status).toBe(200);
    const after = await rows();
    expect(after.Project.map((p) => p.id)).toEqual(["p2"]);
    expect(after.State.every((s) => s.projectId === "p2")).toBe(true);
    expect(after.Issue.map((i) => i.id)).toEqual(["i2"]);
    expect([after.IssueLabel, after.Comment]).toEqual([[], []]);
    expect(after.Activity.every((a) => a.issueId === "i2")).toBe(true);
    expect(after.Label).toHaveLength(1);
  });
});

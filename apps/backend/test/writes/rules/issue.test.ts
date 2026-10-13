import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  allRows,
  createIssue,
  createProject,
  type Fixture,
  fixture,
  insert,
  remove,
  subset,
  update,
} from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("issues", () => {
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
  });

  test("the server numbers issues per project and owns creator and timestamps", async () => {
    await f.send([createIssue("i1", "p1", { number: 99, creatorId: "bob", createdAt: 1 })], "cy");
    await Promise.all([f.send([createIssue("i2", "p1")]), f.send([createIssue("i3", "p1")])]);
    await f.send([createIssue("i4", "p2")]);
    const issues = (await rows()).Issue;
    const byId = Object.fromEntries(issues.map((i) => [i.id, i]));
    expect(byId.i1).toMatchObject({ number: 1, creatorId: "cy", priority: "none", assigneeId: null });
    expect(byId.i1.createdAt).toBeGreaterThan(1);
    expect([byId.i2.number, byId.i3.number].sort()).toEqual([2, 3]);
    expect(byId.i4.number).toBe(1);
  });

  test("a deleted issue's number is never given again", async () => {
    await f.send([createIssue("i1", "p1"), createIssue("i2", "p1")]);
    await f.send([remove("Issue", "i2")]);
    await f.send([createIssue("i3", "p1")]);
    expect((await rows()).Issue.map((i) => [i.id, i.number]).sort()).toEqual([
      ["i1", 1],
      ["i3", 3],
    ]);
  });

  test("references must belong to the issue's project and to current members", async () => {
    expect((await f.send([createIssue("i1", "p1", { stateId: "p2:backlog" })])).status).toBe(400);
    await f.tenant.write((w) => w.update("Member", "cy", { removed: 1 }));
    expect((await f.send([createIssue("i1", "p1", { assigneeId: "cy" })])).status).toBe(400);
    expect((await f.send([createIssue("i1", "p1", { assigneeId: "bob" })])).status).toBe(200);
    expect((await f.send([update("Issue", "i1", { projectId: "p2" })])).status).toBe(200);
    expect((await rows()).Issue[0].projectId).toBe("p1");
  });

  test("changes are recorded as activity", async () => {
    await f.send([createIssue("i1", "p1")]);
    await f.send(
      [update("Issue", "i1", { stateId: "p1:started", priority: "high", description: "x", title: "Issue i1" })],
      "bob",
    );
    const activity = (await rows()).Activity.sort(
      (a, b) => a.createdAt - b.createdAt || a.field.localeCompare(b.field),
    );
    expect(activity.map((a) => [a.field, a.oldValue, a.newValue, a.actorId])).toEqual([
      ["created", null, null, "ada"],
      ["description", null, null, "bob"],
      ["priority", "none", "high", "bob"],
      ["stateId", "p1:backlog", "p1:started", "bob"],
    ]);
  });

  test("only the creator or an admin deletes, and deleting removes labels, comments and activity", async () => {
    await f.send([createIssue("i1", "p1")], "bob");
    await f.send([insert("Label", { id: "l1", name: "Bug", color: "#ff0000" })]);
    await f.send([insert("IssueLabel", { id: "i1:l1", issueId: "i1", labelId: "l1" })]);
    await f.send([insert("Comment", { id: "c1", issueId: "i1", body: "hi" })]);
    expect((await f.send([remove("Issue", "i1")], "cy")).status).toBe(403);
    expect((await f.send([remove("Issue", "i1")], "bob")).status).toBe(200);
    const after = await rows();
    expect([after.Issue, after.IssueLabel, after.Comment, after.Activity]).toEqual([[], [], [], []]);
    await f.send([createIssue("i2", "p1")], "bob");
    expect((await f.send([remove("Issue", "i2")], "ada")).status).toBe(200);
  });
});

describe("sub-issues", () => {
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
    await f.send([createIssue("a", "p1"), createIssue("b", "p1", { parentId: "a" }), createIssue("x", "p2")]);
  });

  test("a parent is an issue of the same project", async () => {
    expect((await rows()).Issue.find((i) => i.id === "b")?.parentId).toBe("a");
    expect((await f.send([createIssue("c", "p1", { parentId: "x" })])).status).toBe(400);
    expect((await f.send([createIssue("c", "p1", { parentId: "missing" })])).status).toBe(400);
    expect((await f.send([update("Issue", "b", { parentId: null })])).status).toBe(200);
    const activity = (await rows()).Activity.filter((a) => a.issueId === "b" && a.field === "parentId");
    expect(activity.map((a) => [a.oldValue, a.newValue])).toEqual([["a", null]]);
  });

  test("an issue cannot become its own ancestor", async () => {
    await f.send([createIssue("c", "p1", { parentId: "b" })]);
    expect((await f.send([update("Issue", "a", { parentId: "a" })])).status).toBe(400);
    expect((await f.send([update("Issue", "a", { parentId: "c" })])).status).toBe(400);
    expect((await f.send([update("Issue", "c", { parentId: "a" })])).status).toBe(200);
  });

  test("deleting a parent keeps its sub-issues, without a parent, and says so in their activity", async () => {
    await f.send([remove("Issue", "a")]);
    const after = await rows();
    expect(after.Issue.find((i) => i.id === "b")?.parentId).toBeNull();
    const detached = after.Activity.find((a) => a.issueId === "b" && a.field === "parentId");
    expect(detached).toMatchObject({ oldValue: "a", newValue: null });
  });
});

describe("dates and estimates", () => {
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
  });

  test("the start date is not after the due date, whichever is set", async () => {
    expect((await f.send([createIssue("i1", "p1", { startDate: "2026-10-02", dueDate: "2026-10-01" })])).status).toBe(
      400,
    );
    await f.send([createIssue("i1", "p1", { startDate: "2026-10-01", dueDate: "2026-10-01" })]);
    expect((await f.send([update("Issue", "i1", { startDate: "2026-10-05" })])).status).toBe(400);
    expect((await f.send([update("Issue", "i1", { dueDate: "2026-09-30" })])).status).toBe(400);
    expect((await f.send([update("Issue", "i1", { startDate: "2026-10-05", dueDate: "2026-10-09" })])).status).toBe(
      200,
    );
    expect((await f.send([update("Issue", "i1", { dueDate: null })])).status).toBe(200);
  });

  test("an estimate is a point of the scale, and its changes are activity", async () => {
    expect((await f.send([createIssue("i1", "p1", { estimate: 4 })])).status).toBe(400);
    await f.send([createIssue("i1", "p1", { estimate: 3 })]);
    await f.send([update("Issue", "i1", { estimate: 8 })]);
    const after = await rows();
    expect(after.Issue[0].estimate).toBe(8);
    expect(after.Activity.find((a) => a.field === "estimate")).toMatchObject({ oldValue: "3", newValue: "8" });
  });
});

describe("archive", () => {
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send([
      createIssue("done", "p1", { stateId: "p1:completed" }),
      createIssue("open", "p1", { stateId: "p1:started" }),
      insert("Label", { id: "l1", name: "Bug", color: "#ff0000" }),
    ]);
  });
  const issue = async (id: string) => (await rows()).Issue.find((i) => i.id === id)!;

  test("only a completed or cancelled issue is archived, at the server's time; null restores it", async () => {
    expect((await f.send([update("Issue", "open", { archivedAt: 1 })])).status).toBe(400);
    expect((await issue("open")).archivedAt).toBeNull();
    expect((await f.send([update("Issue", "done", { archivedAt: 1 })], "bob")).status).toBe(200);
    const archivedAt = (await issue("done")).archivedAt;
    expect(archivedAt).toBeGreaterThan(1);
    await f.send([update("Issue", "done", { archivedAt: 2 })]);
    expect((await issue("done")).archivedAt).toBe(archivedAt);
    expect((await f.send([update("Issue", "done", { archivedAt: null })], "cy")).status).toBe(200);
    expect((await issue("done")).archivedAt).toBeNull();
    const fields = (await subset(f.tenant, "Activity", "done")).rows.map((a) => a.field);
    expect(fields).toEqual(expect.arrayContaining(["archived", "unarchived"]));
  });

  test("an archived issue refuses edits, labels, modules, links, relations and comments", async () => {
    await f.send([insert("Comment", { id: "c1", issueId: "done", body: "hi" })]);
    await f.send([update("Issue", "done", { archivedAt: 1 })]);
    const refused = [
      [update("Issue", "done", { priority: "high" })],
      [insert("IssueLabel", { id: "done:l1", issueId: "done", labelId: "l1" })],
      [
        insert("Module", { id: "m1", projectId: "p1", name: "M" }),
        insert("IssueModule", { id: "done:m1", issueId: "done", moduleId: "m1" }),
      ],
      [insert("IssueLink", { id: "k1", issueId: "done", url: "https://example.com" })],
      [insert("IssueRelation", { id: "done:open", issueId: "done", relatedId: "open", type: "blocks" })],
      [insert("Comment", { id: "c2", issueId: "done", body: "hello" })],
      [update("Comment", "c1", { body: "edited" })],
    ];
    for (const mutations of refused) expect((await f.send(mutations)).status).toBe(400);
    expect(await issue("done")).toMatchObject({ priority: "none" });
    // Restoring and editing in one patch is an edit of an issue that is no longer archived.
    expect((await f.send([update("Issue", "done", { archivedAt: null, priority: "high" })])).status).toBe(200);
  });

  test("deleting a state moves its archived issues; an archived issue can be deleted", async () => {
    await f.send([
      insert("State", {
        id: "s1",
        projectId: "p1",
        name: "Shipped",
        color: "#00ff00",
        group: "completed",
        position: 1,
      }),
    ]);
    await f.send([createIssue("shipped", "p1", { stateId: "s1" })]);
    await f.send([update("Issue", "shipped", { archivedAt: 1 })]);
    const move = await f.send([update("Issue", "shipped", { stateId: "p1:completed" }), remove("State", "s1")]);
    expect(move.status).toBe(200);
    expect(await issue("shipped")).toMatchObject({ stateId: "p1:completed", archivedAt: expect.any(Number) });
    expect((await f.send([remove("Issue", "shipped")])).status).toBe(200);
  });

  test("undoing an archive restores the issue, and redoing archives it again", async () => {
    await f.send([update("Issue", "done", { archivedAt: 1 })], "ada", undefined, "archive");
    expect((await f.revert("archive", "undo")).status).toBe(200);
    expect((await issue("done")).archivedAt).toBeNull();
    expect((await f.revert("undo")).status).toBe(200);
    expect((await issue("done")).archivedAt).toEqual(expect.any(Number));
  });
});

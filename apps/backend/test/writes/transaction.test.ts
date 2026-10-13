import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  bootstrap,
  createIssue,
  createProject,
  type Fixture,
  fixture,
  insert,
  issues,
  remove,
  subset,
  update,
} from "../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
  await f.send(createProject("p", "WEB"));
});
afterEach(() => f.cleanup());
test("scoped reads omit unrelated projects and include the issue at the other end of a cross-project relation", async () => {
  await f.send(createProject("q", "API"));
  await f.send([
    createIssue("a", "p"),
    createIssue("b", "q"),
    createIssue("c", "q"),
    insert("IssueRelation", { id: "a:b", issueId: "a", relatedId: "b", type: "blocks" }),
    insert("IssueLink", { id: "link", issueId: "b", url: "https://example.com" }),
  ]);
  expect((await bootstrap(f.tenant)).rows).not.toHaveProperty("Issue");
  const scoped = await issues(f.tenant, { projectId: "p" });
  expect(scoped.rows.Issue.map((i) => i.id).sort()).toEqual(["a", "b"]);
  // The other end is named, not shown: its own rows load with its project.
  expect(scoped.rows.IssueLink).toEqual([]);
  expect(await issues(f.tenant, { issueId: "a" })).toEqual(scoped);
  expect((await issues(f.tenant)).rows.Issue).toHaveLength(3);
});
test("a deleted issue returns with its number, dependents, child parent and history; redo deletes it", async () => {
  await f.send([
    createIssue("a", "p"),
    createIssue("b", "p", { parentId: "a" }),
    insert("Label", { id: "l", name: "Bug", color: "#ff0000" }),
    insert("IssueLabel", { id: "a:l", issueId: "a", labelId: "l" }),
    insert("Comment", { id: "c", issueId: "a", body: "Hello" }),
    insert("IssueRelation", { id: "a:b", issueId: "a", relatedId: "b", type: "blocks" }),
  ]);
  const original = (await issues(f.tenant)).rows;
  const history = (await subset(f.tenant, "Activity", "a")).rows;
  await f.send([remove("Issue", "a")], "ada", "owner", "delete");
  expect((await f.revert("delete", "undo")).status).toBe(200);
  const back = (await issues(f.tenant)).rows;
  expect(back.Issue.find((i) => i.id === "a")).toEqual(original.Issue.find((i) => i.id === "a"));
  expect(back.Issue.find((i) => i.id === "b")?.parentId).toBe("a");
  expect(back.IssueLabel).toEqual(original.IssueLabel);
  expect(back.IssueRelation).toEqual(original.IssueRelation);
  expect((await subset(f.tenant, "Comment", "a")).rows[0].body).toBe("Hello");
  const restored = (await subset(f.tenant, "Activity", "a")).rows;
  expect(restored.length).toBe(history.length + 1);
  expect(restored.some((a) => a.field === "restored")).toBe(true);
  expect((await f.revert("undo", "redo")).status).toBe(200);
  expect((await issues(f.tenant)).rows.Issue.map((i) => i.id)).toEqual(["b"]);
});
test("a cycle returns with its issues, and updates and inserts revert", async () => {
  await f.send([
    insert("Cycle", { id: "c", projectId: "p", name: "Sprint", startDate: "2026-10-01", endDate: "2026-10-14" }),
    createIssue("a", "p", { cycleId: "c" }),
  ]);
  await f.send([remove("Cycle", "c")], "ada", "owner", "delete");
  expect((await f.revert("delete")).status).toBe(200);
  expect((await issues(f.tenant)).rows.Issue[0].cycleId).toBe("c");
  await f.send([update("Issue", "a", { title: "Changed" })], "ada", "owner", "edit");
  expect((await f.revert("edit")).status).toBe(200);
  expect((await issues(f.tenant)).rows.Issue[0].title).toBe("Issue a");
  await f.send([createIssue("b", "p")], "ada", "owner", "insert");
  expect((await f.revert("insert", "undo")).status).toBe(200);
  expect((await f.revert("undo")).status).toBe(200);
  expect((await issues(f.tenant)).rows.Issue.find((i) => i.id === "b")?.number).toBe(2);
});
test("only the actor can revert; missing references and expired logs conflict; internals never go on the wire", async () => {
  await f.send([createIssue("a", "p")], "ada", "owner", "insert");
  expect((await f.revert("insert", undefined, "bob")).status).toBe(403);
  expect((await f.revert("missing")).status).toBe(409);
  await f.send([remove("Issue", "a")], "ada", "owner", "delete");
  await f.send([remove("Project", "p")]);
  expect((await f.revert("delete")).status).toBe(409);
  for (const row of (await f.tenant.changesAfter(0))!) {
    expect(row).not.toHaveProperty("before");
    expect(row).not.toHaveProperty("actorId");
  }
  const logged = (await f.tenant.write((w) => w.changesOf("delete"))).result!;
  expect(logged.every((c) => c.actorId === "ada")).toBe(true);
  expect(logged.find((c) => c.model === "Issue")?.before).toMatchObject({ id: "a", number: 1 });
});

test("a pruned transaction, including its retained tail, cannot be undone", async () => {
  await f.cleanup();
  f = await fixture({ retentionMs: 0 });
  await f.send(createProject("p", "WEB"), "ada", "owner", "old");
  // Nothing is retained, but a change is only past its retention a moment after it was written.
  await new Promise((resolve) => setTimeout(resolve, 5));
  await f.tenant.close();
  expect((await f.revert("old")).status).toBe(409);
});
test("restores recheck uniqueness and archived projects", async () => {
  await f.send([insert("Label", { id: "l", name: "Bug", color: "#ff0000" })]);
  await f.send([remove("Label", "l")], "ada", "owner", "label-delete");
  await f.send([insert("Label", { id: "other", name: "BUG", color: "#000000" })]);
  expect((await f.revert("label-delete")).status).toBe(409);
  await f.send([createIssue("i", "p")]);
  await f.send([remove("Issue", "i")], "ada", "owner", "issue-delete");
  await f.send([update("Project", "p", { archivedAt: 1 })]);
  expect((await f.revert("issue-delete")).status).toBe(400);
  expect((await issues(f.tenant)).rows.Issue).toEqual([]);
});

test("deleting an archived project can be undone with its exact states and issues", async () => {
  await f.send([
    createIssue("i", "p"),
    createIssue("child", "p", { parentId: "i" }),
    update("Project", "p", { archivedAt: 1 }),
  ]);
  await f.send([remove("Project", "p")], "ada", "owner", "delete-project");
  expect(await f.revert("delete-project", "undo-project")).toMatchObject({ status: 200 });
  expect((await bootstrap(f.tenant)).rows.State).toHaveLength(5);
  expect((await issues(f.tenant)).rows.Issue.find((i) => i.id === "child")?.parentId).toBe("i");
  expect((await f.revert("undo-project")).status).toBe(200);
  expect((await issues(f.tenant)).rows.Issue).toEqual([]);
});

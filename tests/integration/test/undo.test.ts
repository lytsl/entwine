import { afterEach, beforeEach, expect, test } from "bun:test";
import { SyncError } from "@entwine/db-collection";
import { pairId } from "@entwine/shared";
import type { Client } from "./helpers/client";
import { device } from "./helpers/device";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";
import { loadIssues } from "./helpers/loads";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let bob: Session;
let workspaceId: string;
let a: Client;
let b: Client;
beforeEach(async () => {
  h = await harness({ heartbeatMs: 20 });
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
  a = await h.connect(ada, workspaceId, { device: device() });
  b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  await a.mutate(() =>
    a.collections.Label.insert({ id: "bug", name: "bug", nameKey: "bug", color: "#ff0000", createdAt: now }),
  );
});
afterEach(() => h.cleanup());

const setState = (client: Client, issueId: string, stateId: string) =>
  client.mutate(() =>
    client.collections.Issue.update(issueId, (issue) => {
      issue.stateId = stateId;
    }),
  );

test("an undo puts back what the edit replaced, for everyone; a redo applies it again", async () => {
  await createIssue(a, "i1", "p1", ada.userId);
  await setState(a, "i1", "p1:started");
  expect(a.workspace.history.canUndo).toBe(true);

  const undoing = a.workspace.history.undo();
  expect(a.collections.Issue.get("i1")?.stateId).toBe("p1:backlog");
  await undoing;
  await eventually(() => expect(b.collections.Issue.get("i1")?.stateId).toBe("p1:backlog"));
  expect(a.workspace.history.canUndo).toBe(true);
  expect(a.workspace.history.canRedo).toBe(true);

  await a.workspace.history.redo();
  await eventually(() => expect(b.collections.Issue.get("i1")?.stateId).toBe("p1:started"));
  expect(a.workspace.history.canRedo).toBe(false);
});

test("undoing the creation of an issue removes it and its label, as one action", async () => {
  const label = pairId("i1", "bug");
  await a.mutate(() => {
    a.collections.Issue.insert(issueRow("i1"));
    a.collections.IssueLabel.insert({ id: label, issueId: "i1", labelId: "bug" });
  });
  await eventually(() => expect(b.collections.IssueLabel.get(label)).toBeDefined());

  await a.workspace.history.undo();
  await eventually(() => {
    expect(b.collections.Issue.get("i1")).toBeUndefined();
    expect(b.collections.IssueLabel.get(label)).toBeUndefined();
  });
  const server = await h.snapshot(ada, workspaceId);
  expect([server.rows.Issue, server.rows.IssueLabel]).toEqual([[], []]);
});

test("removing a label can be undone, which puts the same row back", async () => {
  await createIssue(a, "i1", "p1", ada.userId);
  const id = pairId("i1", "bug");
  await a.mutate(() => a.collections.IssueLabel.insert({ id, issueId: "i1", labelId: "bug" }));
  await a.mutate(() => a.collections.IssueLabel.delete(id));
  await a.workspace.history.undo();
  await eventually(() => expect(b.collections.IssueLabel.get(id)).toMatchObject({ issueId: "i1", labelId: "bug" }));
});

test("an edit to an issue deleted since cannot be undone, and nothing changes", async () => {
  await createIssue(a, "i1", "p1", ada.userId);
  await setState(a, "i1", "p1:started");
  const otherTab = await h.connect(ada, workspaceId);
  await loadIssues(otherTab, { projectId: "p1" });
  await otherTab.mutate(() => otherTab.collections.Issue.delete("i1"));
  await eventually(() => expect(a.collections.Issue.has("i1")).toBe(false));
  const error = await a.workspace.history.undo().catch((e) => e);
  expect(error).toBeInstanceOf(SyncError);
  expect(error.message).toContain("cannot be undone");
  expect(a.collections.Issue.get("i1")).toBeUndefined();
  expect(a.workspace.history.canUndo).toBe(true);
  expect(a.workspace.history.canRedo).toBe(false);
});

test("an undo the server refuses rolls back and says why", async () => {
  await a.mutate(() =>
    a.collections.Cycle.insert({
      id: "c1",
      projectId: "p1",
      name: "Sprint",
      description: "",
      startDate: "2026-10-01",
      endDate: "2026-10-14",
      creatorId: ada.userId,
      rolledIssues: 0,
      rolledPoints: 0,
      createdAt: now,
      updatedAt: now,
    }),
  );
  await createIssue(a, "i1", "p1", ada.userId);
  await a.mutate(() =>
    a.collections.Issue.update("i1", (issue) => {
      issue.cycleId = "c1";
    }),
  );
  await b.mutate(() =>
    b.collections.Project.update("p1", (p) => {
      p.archivedAt = Date.now();
    }),
  );
  await eventually(() => expect(a.collections.Project.get("p1")?.archivedAt).not.toBeNull());
  const error = await a.workspace.history.undo().catch((e) => e);
  expect(error).toBeInstanceOf(SyncError);
  expect(error.message).toBe("The project is archived");
  expect(a.collections.Issue.get("i1")?.cycleId).toBe("c1");
  expect(a.workspace.history.canRedo).toBe(false);
});

test("a new edit clears what could be redone, and every write is recorded", async () => {
  await createIssue(a, "i1", "p1", ada.userId);
  await setState(a, "i1", "p1:started");
  await a.workspace.history.undo();
  expect(a.workspace.history.canRedo).toBe(true);
  await setState(a, "i1", "p1:completed");
  expect(a.workspace.history.canRedo).toBe(false);
  await a.mutate(() =>
    a.collections.Issue.update("i1", (issue) => {
      issue.title = "Recorded";
    }),
  );
  await a.workspace.history.undo();
  expect(a.collections.Issue.get("i1")).toMatchObject({ stateId: "p1:completed", title: "Issue i1" });
});

function issueRow(id: string) {
  return {
    id,
    projectId: "p1",
    number: 1,
    title: `Issue ${id}`,
    description: "",
    stateId: "p1:backlog",
    priority: "none" as const,
    assigneeId: null,
    creatorId: ada.userId,
    parentId: null,
    startDate: null,
    dueDate: null,
    estimate: null,
    cycleId: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

test("a bulk edit of three issues is one transaction, which one undo reverts for everyone", async () => {
  for (const id of ["i1", "i2", "i3"]) await createIssue(a, id, "p1", ada.userId);
  await a.mutate(() => {
    for (const id of ["i1", "i2", "i3"])
      a.collections.Issue.update(id, (issue) => {
        issue.priority = "high";
      });
  });
  const priorities = (client: Client) => ["i1", "i2", "i3"].map((id) => client.collections.Issue.get(id)?.priority);
  await eventually(() => expect(priorities(b)).toEqual(["high", "high", "high"]));

  await a.workspace.history.undo();
  await eventually(() => expect(priorities(b)).toEqual(["none", "none", "none"]));
  // The step before it is the third issue's creation, which the undo left alone.
  expect(b.collections.Issue.has("i3")).toBe(true);
  await a.workspace.history.redo();
  await eventually(() => expect(priorities(b)).toEqual(["high", "high", "high"]));
});

test("a bulk edit that one issue refuses changes none of them", async () => {
  for (const id of ["i1", "i2"]) await createIssue(a, id, "p1", ada.userId);
  await a.mutate(() =>
    a.collections.Issue.update("i2", (issue) => {
      issue.stateId = "p1:completed";
    }),
  );
  // i1 is in the backlog, so the server refuses to archive it, and with it the whole edit.
  const error = await a
    .mutate(() => {
      for (const id of ["i2", "i1"])
        a.collections.Issue.update(id, (issue) => {
          issue.archivedAt = now;
        });
    })
    .catch((e) => e);
  expect(error).toBeInstanceOf(SyncError);
  await eventually(() => expect(a.collections.Issue.get("i2")?.archivedAt).toBeNull());
  const server = await h.snapshot(ada, workspaceId);
  expect(server.rows.Issue.map((issue) => issue.archivedAt)).toEqual([null, null]);
});

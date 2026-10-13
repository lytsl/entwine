import { afterEach, beforeEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { SyncError, Workspace } from "@entwine/db-collection";
import { issueRelationId, type Rows, syncSchema } from "@entwine/shared";
import { ORIGIN } from "./helpers/client";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";
import { bootstraps, loadIssues } from "./helpers/loads";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let bob: Session;
let workspaceId: string;
beforeEach(async () => {
  // A short heartbeat, so that session checks and stall detection run in milliseconds.
  h = await harness({ heartbeatMs: 20 });
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
});
afterEach(() => h.cleanup());

test("the workspace loads into the collections", async () => {
  const client = await h.connect(ada, workspaceId);
  expect(client.collections.Member.toArray.map((m) => m.name).sort()).toEqual(["ada", "bob"]);
  expect(client.workspace.cursor).toBeGreaterThan(0);
});

test("a write shows at once, then the server's row replaces it; others see it live", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  const creating = createProject(a, "p1", "web");
  expect(a.collections.Project.get("p1")?.identifier).toBe("WEB");
  expect(a.collections.State.size).toBe(5);
  // An issue in a project the server has not confirmed yet references its derived default state.
  const issuing = createIssue(a, "i1", "p1", ada.userId);
  expect(a.collections.Issue.get("i1")?.number).toBe(1);
  await Promise.all([creating, issuing]);
  expect(a.collections.Issue.get("i1")).toMatchObject({ number: 1, creatorId: ada.userId });
  await eventually(() => expect(b.collections.Issue.get("i1")?.title).toBe("Issue i1"));
  expect(b.collections.Activity.toArray.map((x) => x.field)).toEqual(["created"]);
});

test("concurrent creates get distinct server numbers on every client", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  await eventually(() => expect(b.collections.Project.get("p1")).toBeDefined());
  await Promise.all([createIssue(a, "ia", "p1", ada.userId), createIssue(b, "ib", "p1", bob.userId)]);
  for (const client of [a, b]) {
    await eventually(() => {
      const numbers = client.collections.Issue.toArray.map((i) => i.number).sort();
      expect(numbers).toEqual([1, 2]);
    });
  }
});

test("a refused write rolls back and says why", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  await a.mutate(() =>
    a.collections.Comment.insert({
      id: "c1",
      issueId: "i1",
      authorId: ada.userId,
      body: "mine",
      createdAt: now,
      updatedAt: now,
      editedAt: null,
    }),
  );
  await eventually(() => expect(b.collections.Comment.get("c1")).toBeDefined());
  const editing = b.mutate(() =>
    b.collections.Comment.update("c1", (c) => {
      c.body = "hijacked";
    }),
  );
  expect(b.collections.Comment.get("c1")?.body).toBe("hijacked");
  const error = await editing.catch((e) => e);
  expect(error).toBeInstanceOf(SyncError);
  expect(error.code).toBe("forbidden");
  expect(b.collections.Comment.get("c1")?.body).toBe("mine");
});

test("a direct collection write goes through the collection's handlers", async () => {
  const a = await h.connect(ada, workspaceId);
  await createProject(a, "p1", "WEB");
  const tx = a.collections.Project.update("p1", (p) => {
    p.name = "Website";
  });
  await tx.when("settled");
  const b = await h.connect(bob, workspaceId);
  expect(b.collections.Project.get("p1")?.name).toBe("Website");
});

test("a client reconnecting after missed commits converges", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await eventually(() => expect(b.workspace.status).toBe("live"));
  b.faults.dropStream();
  await eventually(() => expect(b.workspace.status).toBe("offline"));
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  await eventually(() => expect(b.workspace.status).toBe("live"), 5000);
  await eventually(() => expect(b.collections.Issue.get("i1")?.number).toBe(1));
  expect(b.workspace.cursor).toBe(a.workspace.cursor);
});

test("a removed member's stream is revoked", async () => {
  const b = await h.connect(bob, workspaceId);
  const full = (await (
    await h.server.app.fetch(
      new Request(`http://localhost:3000/api/auth/organization/get-full-organization?organizationId=${workspaceId}`, {
        headers: { Cookie: ada.cookie },
      }),
    )
  ).json()) as { members: { id: string; userId: string }[] };
  const member = full.members.find((m) => m.userId === bob.userId)!;
  await h.post(
    "/api/auth/organization/remove-member",
    { memberIdOrEmail: member.id, organizationId: workspaceId },
    ada.cookie,
  );
  await eventually(() => expect(b.workspace.status).toBe("revoked"));
});

const increasing = (ids: number[]) => ids.every((id, i) => i === 0 || id > ids[i - 1]);

test("a write whose answer is lost is confirmed, not reported, and applied once", async () => {
  const a = await h.connect(ada, workspaceId);
  await createProject(a, "p1", "WEB");
  a.faults.loseNextResponse();
  await createIssue(a, "i1", "p1", ada.userId);
  const server = await h.snapshot(ada, workspaceId);
  expect(server.rows.Issue.map((i) => i.number)).toEqual([1]);
  expect(server.rows.Activity.map((x) => x.field)).toEqual(["created"]);
  expect(a.collections.Issue.get("i1")?.number).toBe(1);
});

test("a write is retried after a brief network failure and saved once", async () => {
  const a = await h.connect(ada, workspaceId);
  a.faults.failNextRequest();
  await createProject(a, "p1", "WEB");
  expect(a.collections.Project.get("p1")).toBeDefined();
  expect((await h.snapshot(ada, workspaceId)).rows.Project).toHaveLength(1);
});

test("a write made while the server is unreachable stays shown and waits in the tab until it is back", async () => {
  const a = await h.connect(ada, workspaceId);
  a.faults.offline = true;
  const saved = createProject(a, "p1", "WEB");
  await eventually(() => expect(a.workspace.queued()).toBe(1));
  expect(a.collections.Project.get("p1")?.identifier).toBe("WEB");
  a.faults.offline = false;
  await saved;
  expect(a.workspace.queued()).toBe(0);
  expect((await h.snapshot(ada, workspaceId)).rows.Project.map((p) => p.id)).toEqual(["p1"]);
});

test("writes that build on each other reach the server in order", async () => {
  const a = await h.connect(ada, workspaceId);
  const writes = [createProject(a, "p1", "WEB")];
  for (let i = 1; i <= 5; i++) writes.push(createIssue(a, `i${i}`, "p1", ada.userId));
  await Promise.all(writes);
  expect(a.collections.Issue.toArray.map((i) => i.number).sort()).toEqual([1, 2, 3, 4, 5]);
});

test("a stalled stream is noticed, and the client catches up exactly once and in order", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId, { stallMs: 100 });
  b.faults.stallStream();
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  await eventually(() => expect(b.collections.Issue.get("i1")?.number).toBe(1), 3000);
  expect(b.workspace.status).toBe("live");
  expect(increasing(b.received)).toBe(true);
  expect(b.workspace.cursor).toBe(a.workspace.cursor);
});

test("a client whose workspace file was rebuilt loads it again in place and continues live", async () => {
  const a = await h.connect(ada, workspaceId);
  await createProject(a, "p1", "WEB");
  const epoch = a.workspace.epoch;
  // Offline, so that no heartbeat of its stream reopens the file while it is deleted.
  a.faults.offline = true;
  a.faults.dropStream();
  await eventually(() => expect(a.workspace.status).toBe("offline"));
  await (await h.server.tenants.tenant(workspaceId)).close();
  // Windows keeps the file locked until the closed connection's statements are collected.
  await eventually(() => {
    Bun.gc(true);
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(join(h.dir, "tenants", `${workspaceId}.db${suffix}`), { force: true });
  });
  a.faults.offline = false;
  await eventually(() => expect(a.workspace.epoch).not.toBe(epoch), 5000);
  await eventually(() => expect(a.workspace.status).toBe("live"));
  expect(a.collections.Project.get("p1")).toBeUndefined();
  const b = await h.connect(bob, workspaceId);
  await createProject(b, "p2", "API");
  await eventually(() => expect(a.collections.Project.get("p2")).toBeDefined());
});

test("a client away longer than the server keeps changes loads the workspace again in place", async () => {
  await h.cleanup();
  h = await harness({ heartbeatMs: 20, retentionMs: 0 });
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await loadIssues(a, "all");
  a.faults.offline = true;
  a.faults.dropStream();
  await eventually(() => expect(a.workspace.status).toBe("offline"));
  await createProject(b, "p1", "WEB");
  await createIssue(b, "i1", "p1", bob.userId);
  // Every write prunes the changes made before it, so the log no longer reaches back to a's position.
  expect(await (await h.server.tenants.tenant(workspaceId)).changesAfter(a.workspace.cursor)).toBeNull();
  const before = bootstraps(a);
  a.faults.offline = false;
  await eventually(() => expect(a.collections.Issue.get("i1")?.number).toBe(1), 5000);
  await eventually(() => expect(a.workspace.status).toBe("live"));
  expect(bootstraps(a)).toBe(before + 1);
  expect(a.workspace.cursor).toBe((await h.snapshot(ada, workspaceId)).cursor);
  await createIssue(b, "i2", "p1", bob.userId);
  await eventually(() => expect(a.collections.Issue.get("i2")?.number).toBe(2));
});

test("a stream ends soon after its session is signed out", async () => {
  const b = await h.connect(bob, workspaceId);
  await eventually(() => expect(b.workspace.status).toBe("live"));
  await h.post("/api/auth/sign-out", {}, bob.cookie);
  await eventually(() => expect(b.workspace.status).toBe("unauthenticated"));
});

test("a client never receives another workspace's changes", async () => {
  const other = await h.workspace(ada, "other");
  const a = await h.connect(ada, workspaceId);
  const elsewhere = await h.connect(ada, other);
  await createProject(elsewhere, "p2", "API");
  await createProject(a, "p1", "WEB");
  expect(a.collections.Project.toArray.map((p) => p.id)).toEqual(["p1"]);
  expect(elsewhere.collections.Project.toArray.map((p) => p.id)).toEqual(["p2"]);
});

test("a closed client stops syncing and rejects its unconfirmed write", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(b, "p0", "OPS");
  await eventually(() => expect(a.collections.Project.get("p0")).toBeDefined());
  a.faults.stallStream();
  const writing = createProject(a, "p1", "WEB").catch((e) => e);
  await eventually(async () => expect((await h.snapshot(ada, workspaceId)).rows.Project).toHaveLength(2));
  void a.close();
  const error = await writing;
  expect(error).toBeInstanceOf(SyncError);
  const requests = a.requests();
  await createProject(b, "p2", "API");
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(a.requests()).toBe(requests);
  expect(a.collections.Project.get("p2")).toBeUndefined();
});

test("a project deleted by its owner disappears, with its states and issues, from another client", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  await createProject(a, "p2", "API");
  await createIssue(a, "i1", "p1", ada.userId);
  await createIssue(a, "i2", "p2", ada.userId);
  await eventually(() => expect(b.collections.Issue.size).toBe(2));
  await a.mutate(() => a.collections.Project.delete("p1"));
  // The client deleted only the project; the server's deletions of its dependents reach both clients.
  for (const client of [a, b]) {
    await eventually(() => {
      expect(client.collections.Project.toArray.map((p) => p.id)).toEqual(["p2"]);
      expect(client.collections.Issue.toArray.map((i) => i.id)).toEqual(["i2"]);
      expect(client.collections.State.toArray.every((s) => s.projectId === "p2")).toBe(true);
      expect(client.collections.Activity.toArray.every((x) => x.issueId === "i2")).toBe(true);
    });
  }
});

test("a parent deleted on one client leaves its sub-issues parentless and drops its relations on another", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  for (const id of ["parent", "child", "other"]) await createIssue(a, id, "p1", ada.userId);
  await b.mutate(() => {
    b.collections.Issue.update("child", (issue) => {
      issue.parentId = "parent";
    });
    b.collections.IssueRelation.insert({
      id: issueRelationId("parent", "other"),
      issueId: "parent",
      relatedId: "other",
      type: "blocks",
      createdAt: now,
    });
  });
  await eventually(() => expect(a.collections.IssueRelation.size).toBe(1));
  await a.mutate(() => a.collections.Issue.delete("parent"));
  for (const client of [a, b]) {
    await eventually(() => {
      expect(client.collections.Issue.get("child")?.parentId).toBeNull();
      expect(client.collections.IssueRelation.size).toBe(0);
      const relations = client.collections.Activity.toArray.filter(
        (x) => x.issueId === "other" && x.field === "relation",
      );
      expect(relations.map((x) => [x.oldValue, x.newValue]).sort()).toEqual([
        [null, "blocked_by:parent"],
        ["blocked_by:parent", null],
      ]);
    });
  }
});

test("a relation to an issue of a project the client has not loaded brings that issue, and only that", async () => {
  const a = await h.connect(ada, workspaceId);
  await createProject(a, "p1", "WEB");
  await createProject(a, "p2", "API");
  for (const id of ["i1", "i3"]) await createIssue(a, id, "p1", ada.userId);
  for (const id of ["i2", "i4"]) await createIssue(a, id, "p2", ada.userId);
  const b = await h.connect(bob, workspaceId);
  await loadIssues(b, { projectId: "p1" });
  expect(b.collections.Issue.has("i2")).toBe(false);
  const loads = b.loads.length;
  const relate = (issueId: string, relatedId: string) =>
    a.mutate(() =>
      a.collections.IssueRelation.insert({
        id: issueRelationId(issueId, relatedId),
        issueId,
        relatedId,
        type: "blocks",
        createdAt: now,
      }),
    );

  // Within the project, and edits that move nothing into it: every row came on the stream.
  await relate("i1", "i3");
  await createIssue(a, "i5", "p1", ada.userId);
  await a.mutate(() =>
    a.collections.Issue.update("i1", (issue) => {
      issue.title = "Renamed";
    }),
  );
  await eventually(() => expect(b.collections.Issue.get("i1")?.title).toBe("Renamed"));
  expect(b.collections.IssueRelation.size).toBe(1);
  expect(b.loads.length).toBe(loads);

  await relate("i1", "i2");
  await eventually(() => expect(b.collections.Issue.get("i2")?.title).toBe("Issue i2"));
  expect(b.loads.slice(loads)).toEqual([[{ model: "Issue", where: { id: "i2" } }]]);
  expect(b.collections.Issue.has("i4")).toBe(false);
});

test("a project deleted on one client removes its views on another, and keeps the workspace's", async () => {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  const view = (id: string, projectId: string | null) => ({
    id,
    name: id,
    projectId,
    query: JSON.stringify({ layout: "board" }),
    creatorId: bob.userId,
    createdAt: now,
    updatedAt: now,
  });
  await b.mutate(() => {
    b.collections.View.insert(view("project-view", "p1"));
    b.collections.View.insert(view("all-view", null));
  });
  await eventually(() => expect(a.collections.View.size).toBe(2));
  await a.mutate(() => a.collections.Project.delete("p1"));
  await eventually(() => expect(b.collections.View.toArray.map((v) => v.id)).toEqual(["all-view"]));
});

test("a member's issues load alone, with their family, and an issue assigned later brings its label", async () => {
  const a = await h.connect(ada, workspaceId);
  await createProject(a, "p1", "WEB");
  for (const id of ["i1", "i2", "i3", "i4", "i5"]) await createIssue(a, id, "p1", ada.userId);
  await a.mutate(() => {
    a.collections.Label.insert({ id: "bug", name: "bug", nameKey: "bug", color: "#ff0000", createdAt: now });
    a.collections.IssueLabel.insert({ id: "i4:bug", issueId: "i4", labelId: "bug" });
    // i1 is Bob's, i2 is its parent and i3 its sub-issue; i4 and i5 are nobody's.
    a.collections.Issue.update("i1", (issue) => {
      issue.assigneeId = bob.userId;
      issue.parentId = "i2";
    });
    a.collections.Issue.update("i3", (issue) => {
      issue.parentId = "i1";
    });
  });
  const b = await h.connect(bob, workspaceId);
  await loadIssues(b, { assigneeId: bob.userId });
  expect([...b.collections.Issue.keys()].sort()).toEqual(["i1", "i2", "i3"]);

  await a.mutate(() =>
    a.collections.Issue.update("i4", (issue) => {
      issue.assigneeId = bob.userId;
    }),
  );
  await eventually(() => expect(b.collections.IssueLabel.has("i4:bug")).toBe(true));
  expect(b.collections.Issue.has("i5")).toBe(false);
});

test("a search answers its rows in their order and its counts, and the rows it brought stay current", async () => {
  const a = await h.connect(ada, workspaceId);
  await createProject(a, "p1", "web");
  for (const id of ["i1", "i2", "i3"]) await createIssue(a, id, "p1", ada.userId);
  // Connected after the issues were made: the stream has brought it none of them.
  const b = await h.connect(bob, workspaceId);
  const found = await b.workspace.find([
    { model: "Issue", order: [{ field: "number", desc: true }], limit: 2 },
    { model: "Issue", count: ["projectId"] },
  ]);
  expect(found.rows.Issue.map((issue) => issue.id)).toEqual(["i3", "i2"]);
  expect(found.counts?.[1]).toEqual([{ values: ["p1"], count: 3 }]);
  expect(b.collections.Issue.get("i1")).toBeUndefined();
  await a.workspace.mutate(() => a.collections.Issue.update("i3", (issue) => void (issue.title = "Renamed")));
  await eventually(() => expect(b.collections.Issue.get("i3")?.title).toBe("Renamed"));
});

test("a workspace whose first load keeps failing says why while it tries again, and opens once it is answered", async () => {
  let failed = true;
  let unreachable = false;
  const workspace = new Workspace<Rows>({
    schema: syncSchema,
    url: `${ORIGIN}/api/w/${workspaceId}`,
    fetch: async (url, init) => {
      if (unreachable) throw new TypeError("fetch failed");
      if (failed && url.endsWith("/load")) return Response.json({ error: "It broke", code: "failed" }, { status: 500 });
      return h.request(url.slice(ORIGIN.length), init, ada.cookie);
    },
  });
  await eventually(() => expect(workspace.failing?.message).toBe("It broke"), 5000);
  unreachable = true;
  workspace.retry();
  await eventually(() => expect(workspace.failing?.message).toBe("The server could not be reached"), 5000);
  unreachable = false;
  failed = false;
  workspace.retry();
  await workspace.ready;
  expect(workspace.failing).toBeUndefined();
  expect(workspace.collections.Member.size).toBe(2);
  await workspace.release();
});

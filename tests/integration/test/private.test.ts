/** Rows that are one member's alone (notifications), as the clients of several members hold them. */
import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Client } from "./helpers/client";
import { device } from "./helpers/device";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";
import { bootstraps, loadIssues } from "./helpers/loads";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let bob: Session;
let workspaceId: string;
const start = async (options: Parameters<typeof harness>[0]) => {
  h = await harness(options);
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
};
beforeEach(() => start({ heartbeatMs: 20 }));
afterEach(() => h.cleanup());

const comment = (client: Client, authorId: string, body = "Hello") =>
  client.mutate(() =>
    client.collections.Comment.insert({
      id: crypto.randomUUID(),
      issueId: "i1",
      authorId,
      body,
      createdAt: now,
      updatedAt: now,
      editedAt: null,
    }),
  );
const kinds = (client: Client) =>
  client.collections.Notification.toArray.map((n) => `${n.kind}:${n.readAt ? "read" : "unread"}`);

test("a notification reaches its member's tabs only, and the write that caused it settles for its author", async () => {
  const laptop = device();
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId, { device: laptop });
  const b2 = await h.connect(bob, workspaceId, { device: laptop });
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  await a.mutate(() => a.collections.Issue.update("i1", (issue) => void (issue.assigneeId = bob.userId)));
  // The last change of this transaction is Bob's notification, which Ada's stream leaves out: it settles all the same.
  await comment(a, ada.userId);
  for (const tab of [b, b2])
    await eventually(() => expect(kinds(tab).sort()).toEqual(["assigned:unread", "commented:unread"]));
  expect(a.collections.Notification.size).toBe(0);
  expect(a.workspace.cursor).toBe(b.workspace.cursor);
  expect(a.workspace.queued()).toBe(0);

  // Bob reads one in a tab; his other tab follows, and Ada's client hears nothing of it but the position.
  const assigned = b.collections.Notification.toArray.find((n) => n.kind === "assigned")!;
  await b.mutate(() => b.collections.Notification.update(assigned.id, (n) => void (n.readAt = Date.now())));
  await eventually(() => expect(kinds(b2).sort()).toEqual(["assigned:read", "commented:unread"]));
  await eventually(() => expect(a.workspace.cursor).toBe(b.workspace.cursor));
  expect(a.collections.Notification.size).toBe(0);

  // Ada cannot write it, though she knows its id.
  await expect(a.mutate(() => a.collections.Notification.insert({ ...assigned, readAt: null }))).rejects.toMatchObject({
    code: "forbidden",
  });
  expect(a.collections.Notification.size).toBe(0);

  // Bob's device keeps them: a tab opened without the network counts them.
  await Promise.all([b.close(), b2.close()]);
  const offline = await h.connect(bob, workspaceId, { device: laptop, offline: true });
  expect(kinds(offline).sort()).toEqual(["assigned:read", "commented:unread"]);
});

test("a client told to reset loads its own member's notifications again, and nobody else's", async () => {
  await h.cleanup();
  await start({ heartbeatMs: 20, retentionMs: 0 });
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await loadIssues(b, "all");
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  await eventually(() => expect(b.collections.Issue.get("i1")).toBeDefined());
  for (const client of [a, b]) {
    client.faults.offline = true;
    client.faults.dropStream();
  }
  await eventually(() => expect([a.workspace.status, b.workspace.status]).toEqual(["offline", "offline"]));
  const c = await h.connect(ada, workspaceId);
  await loadIssues(c, "all");
  await c.mutate(() => c.collections.Issue.update("i1", (issue) => void (issue.assigneeId = bob.userId)));
  await comment(c, ada.userId);
  // Every write prunes the changes before it, so neither position is in the log any more.
  const before = [bootstraps(a), bootstraps(b)];
  for (const client of [a, b]) client.faults.offline = false;
  await eventually(() => expect([bootstraps(a), bootstraps(b)]).toEqual([before[0] + 1, before[1] + 1]), 5000);
  await eventually(() => expect(kinds(b).sort()).toEqual(["assigned:unread", "commented:unread"]), 5000);
  await eventually(() => expect(a.workspace.status).toBe("live"));
  expect(a.collections.Notification.size).toBe(0);
});

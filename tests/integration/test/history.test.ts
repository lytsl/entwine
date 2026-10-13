/** An issue's comments and activity, loaded when the issue is opened. */
import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Client } from "./helpers/client";
import { device } from "./helpers/device";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";
import { loadHistory } from "./helpers/loads";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let bob: Session;
let workspaceId: string;
beforeEach(async () => {
  h = await harness({ heartbeatMs: 20 });
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
});
afterEach(() => h.cleanup());

const comment = (client: Client, id: string, issueId: string, authorId: string, body: string) =>
  client.mutate(() =>
    client.collections.Comment.insert({ id, issueId, authorId, body, createdAt: now, updatedAt: now, editedAt: null }),
  );

const historyRequests = (client: Client) =>
  client.loads.flat().filter((query) => query.model === "Comment" || query.model === "Activity").length;

async function withHistory() {
  const b = await h.connect(bob, workspaceId);
  await createProject(b, "p1", "WEB");
  await createIssue(b, "i1", "p1", bob.userId);
  await createIssue(b, "i2", "p1", bob.userId);
  await comment(b, "c1", "i1", bob.userId, "first");
  await comment(b, "c2", "i2", bob.userId, "second");
  return b;
}

test("the workspace loads without any issue's history; opening an issue loads its history once", async () => {
  const b = await withHistory();
  const a = await h.connect(ada, workspaceId);
  expect(a.collections.Comment.size).toBe(0);
  expect(a.collections.Activity.size).toBe(0);

  await loadHistory(a, "i1");
  expect(historyRequests(a)).toBe(2);
  expect(a.collections.Comment.toArray.map((c) => c.id)).toEqual(["c1"]);
  expect(a.collections.Activity.toArray.map((x) => [x.issueId, x.field])).toEqual([["i1", "created"]]);

  await loadHistory(a, "i1");
  expect(historyRequests(a)).toBe(2);

  await comment(b, "c3", "i1", bob.userId, "later");
  await eventually(() => expect(a.collections.Comment.get("c3")?.body).toBe("later"));
});

test("a history loaded before shows after a reload without a request", async () => {
  await withHistory();
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  await loadHistory(first, "i2");
  await first.close();

  const reloaded = await h.connect(ada, workspaceId, { device: laptop });
  await loadHistory(reloaded, "i2");
  expect(historyRequests(reloaded)).toBe(0);
  expect(reloaded.collections.Comment.get("c2")?.body).toBe("second");
});

test("a comment edited while the history loads ends edited, not as the load read it", async () => {
  const b = await withHistory();
  const a = await h.connect(ada, workspaceId);
  const hold = a.faults.holdNextResponse('"model":"Comment"');
  const loading = loadHistory(a, "i1");
  await hold.reached;
  await b.mutate(() =>
    b.collections.Comment.update("c1", (c) => {
      c.body = "edited";
    }),
  );
  await eventually(() => expect(a.workspace.cursor).toBe(b.workspace.cursor));
  hold.release();
  await loading;
  expect(a.collections.Comment.get("c1")?.body).toBe("edited");
});

test("a comment deleted while the history loads stays deleted", async () => {
  const b = await withHistory();
  const a = await h.connect(ada, workspaceId);
  const hold = a.faults.holdNextResponse('"model":"Comment"');
  const loading = loadHistory(a, "i1");
  await hold.reached;
  await b.mutate(() => b.collections.Comment.delete("c1"));
  await eventually(() => expect(a.workspace.cursor).toBe(b.workspace.cursor));
  hold.release();
  await loading;
  expect(a.collections.Comment.get("c1")).toBeUndefined();
});

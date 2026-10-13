/** Tabs of one member sharing the device's store: each follows the server, one keeps the store up to date. */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { issueQueries } from "@entwine/shared";
import type { Client } from "./helpers/client";
import { device, kept, sessionStore } from "./helpers/device";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";
import { bootstraps, loadHistory, loadIssues } from "./helpers/loads";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let workspaceId: string;
beforeEach(async () => {
  h = await harness({ heartbeatMs: 20 });
  ada = await h.signUp("ada");
  workspaceId = await h.workspace(ada, "acme");
});
afterEach(() => h.cleanup());

const issueLoads = (client: Client) => client.loads.flat().filter((query) => query.model === "Issue").length;

const offline = (client: Client) => {
  client.faults.offline = true;
  client.faults.dropStream();
};

test("a second tab opens from the device, follows the server itself, and writes online and offline", async () => {
  const laptop = device();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(a, "p", "WEB");
  await createIssue(a, "i", "p", ada.userId);
  const b = await h.connect(ada, workspaceId, { device: laptop });
  expect(a.workspace.role).toBe("leader");
  expect(b.workspace.role).toBe("follower");
  expect(bootstraps(b)).toBe(0);
  // The leader stored the issue as the stream brought it.
  expect(b.collections.Issue.has("i")).toBe(true);
  await loadIssues(b, { projectId: "p" });
  await loadHistory(b, "i");
  expect(b.collections.Activity.size).toBeGreaterThan(0);
  await b.mutate(() =>
    b.collections.Issue.update("i", (r) => {
      r.title = "Follower";
    }),
  );
  await eventually(() => expect(a.collections.Issue.get("i")?.title).toBe("Follower"));
  offline(b);
  await eventually(() => expect(b.workspace.status).toBe("offline"));
  const saving = b.mutate(() =>
    b.collections.Issue.update("i", (r) => {
      r.priority = "high";
    }),
  );
  await eventually(() => expect(kept(laptop)).toBe(1));
  expect(b.workspace.queued()).toBe(1);
  expect(a.collections.Issue.get("i")?.priority).toBe("none");
  b.faults.offline = false;
  await saving;
  expect(b.workspace.queued()).toBe(0);
  await eventually(() => expect(a.collections.Issue.get("i")?.priority).toBe("high"));
  await eventually(() => expect(kept(laptop)).toBe(0));
});

test("the leader's kept writes are sent by the tab that takes over when it closes", async () => {
  const laptop = device();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(a, "p", "WEB");
  await createIssue(a, "i", "p", ada.userId);
  const b = await h.connect(ada, workspaceId, { device: laptop });
  offline(a);
  void a
    .mutate(() =>
      a.collections.Issue.update("i", (r) => {
        r.title = "Kept";
      }),
    )
    .catch(() => {});
  await eventually(() => expect(kept(laptop)).toBe(1));
  await a.close();
  await eventually(() => expect(b.workspace.role).toBe("leader"));
  await eventually(async () => expect((await h.snapshot(ada, workspaceId)).rows.Issue[0].title).toBe("Kept"));
  await eventually(() => expect(b.collections.Issue.get("i")?.title).toBe("Kept"));
  expect(b.paths.filter((p) => p.endsWith("/transactions"))).toHaveLength(1);
  await eventually(() => expect(kept(laptop)).toBe(0));
});

test("a closed tab's kept writes are sent by the leader once the server is reachable again", async () => {
  const laptop = device();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(a, "p", "WEB");
  await createIssue(a, "i", "p", ada.userId);
  const b = await h.connect(ada, workspaceId, { device: laptop });
  offline(a);
  offline(b);
  void b
    .mutate(() =>
      b.collections.Issue.update("i", (r) => {
        r.title = "From the closed tab";
      }),
    )
    .catch(() => {});
  await eventually(() => expect(kept(laptop)).toBe(1));
  await b.close();
  a.faults.offline = false;
  await eventually(() => expect(a.collections.Issue.get("i")?.title).toBe("From the closed tab"));
  expect((await h.snapshot(ada, workspaceId)).rows.Issue[0].title).toBe("From the closed tab");
  await eventually(() => expect(kept(laptop)).toBe(0));
});

test("first visit is ready before the store finishes writing", async () => {
  const laptop = device();
  const release = laptop.holdWrites();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  expect(a.collections.Member.has(ada.userId)).toBe(true);
  release();
  await a.close();
  expect((await laptop.store.read())?.position.epoch).toBe(a.workspace.epoch);
});

test("loaded scopes are stored for the next tab, and a load guards against a racing stream update", async () => {
  const writer = await h.connect(ada, workspaceId);
  await createProject(writer, "p", "WEB");
  await createProject(writer, "q", "API");
  await createIssue(writer, "i", "p", ada.userId);
  await createIssue(writer, "j", "q", ada.userId);
  const laptop = device();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  expect(a.collections.Issue.size).toBe(0);
  const hold = a.faults.holdNextResponse('"model":"Issue"');
  const loading = loadIssues(a, { projectId: "p" });
  await hold.reached;
  await writer.mutate(() =>
    writer.collections.Issue.update("i", (r) => {
      r.title = "Raced";
    }),
  );
  await eventually(() => expect(a.collections.Issue.get("i")?.title).toBe("Raced"));
  hold.release();
  await loading;
  expect(a.collections.Issue.get("i")?.title).toBe("Raced");
  expect(a.collections.Issue.has("j")).toBe(false);
  // The raced update may also load what `i` brings, since the tab cannot tell it from a move into the project.
  const loaded = issueLoads(a);
  await loadIssues(a, { projectId: "p" });
  expect(issueLoads(a)).toBe(loaded);
  await a.close();

  const b = await h.connect(ada, workspaceId, { device: laptop, offline: true });
  await loadIssues(b, { projectId: "p" });
  expect(issueLoads(b)).toBe(0);
  expect(b.collections.Issue.get("i")?.title).toBe("Raced");
  b.faults.offline = false;
  await loadIssues(b, "all");
  expect(b.collections.Issue.size).toBe(2);
});

test("a tab that takes over brings the store up to what it has seen, for the next tab to open from", async () => {
  const laptop = device();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(a, "p", "WEB");
  const b = await h.connect(ada, workspaceId, { device: laptop });
  offline(a);
  const writer = await h.connect(ada, workspaceId);
  await createIssue(writer, "i", "p", ada.userId);
  await eventually(() => expect(b.collections.Issue.has("i")).toBe(true));
  await a.close();
  await eventually(() => expect(b.workspace.role).toBe("leader"));
  await eventually(async () => expect((await laptop.store.read())?.position.cursor).toBe(b.workspace.cursor));
  await b.close();
  const c = await h.connect(ada, workspaceId, { device: laptop, offline: true });
  expect(c.collections.Issue.get("i")?.number).toBe(1);
});

test("undo restores a delete and edits outside issues, and survives reload of the tab", async () => {
  const laptop = device();
  const session = sessionStore();
  const a = await h.connect(ada, workspaceId, { device: laptop, session });
  await createProject(a, "p", "WEB");
  await createIssue(a, "i", "p", ada.userId);
  await a.mutate(() => a.collections.Issue.delete("i"));
  await a.workspace.history.undo();
  expect(a.collections.Issue.get("i")?.number).toBe(1);
  await a.mutate(() =>
    a.collections.Project.update("p", (r) => {
      r.name = "New";
    }),
  );
  await a.close();
  const b = await h.connect(ada, workspaceId, { device: laptop, session });
  await b.workspace.history.undo();
  expect(b.collections.Project.get("p")?.name).toBe("WEB");
  await b.workspace.history.redo();
  expect(b.collections.Project.get("p")?.name).toBe("New");
});

test("offline undo stays queued behind the edit and its redo history survives reload", async () => {
  const laptop = device();
  const session = sessionStore();
  const a = await h.connect(ada, workspaceId, { device: laptop, session });
  await createProject(a, "p", "WEB");
  await createIssue(a, "i", "p", ada.userId);
  offline(a);
  void a
    .mutate(() =>
      a.collections.Issue.update("i", (r) => {
        r.title = "Offline";
      }),
    )
    .catch(() => {});
  void a.workspace.history.undo().catch(() => {});
  await eventually(async () => expect(kept(laptop)).toBe(2));
  await a.close();
  const b = await h.connect(ada, workspaceId, { device: laptop, session });
  await eventually(() => expect(b.workspace.queued()).toBe(0));
  await eventually(() => expect(b.collections.Issue.get("i")?.title).toBe("Issue i"));
  expect(b.workspace.history.canRedo).toBe(true);
  await b.workspace.history.redo();
  expect(b.collections.Issue.get("i")?.title).toBe("Offline");
});

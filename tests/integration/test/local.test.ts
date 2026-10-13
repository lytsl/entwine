/** A client that keeps the workspace on its device: resuming, writes kept while offline, and releasing. */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createLiveQueryCollection } from "@tanstack/db";
import { device, kept } from "./helpers/device";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";
import { bootstraps, loadHistory } from "./helpers/loads";

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

test("releasing a workspace retires its live queries before their source collections", async () => {
  const client = await h.connect(ada, workspaceId);
  const query = createLiveQueryCollection({
    query: (q) => q.from({ project: client.collections.Project }),
    startSync: true,
    gcTime: Infinity,
  });
  await query.toArrayWhenReady();
  client.workspace.trackQuery(query);
  client.workspace.trackQuery(query);
  const statuses: string[] = [];
  query.on("status:cleaned-up", () => statuses.push("query"));
  client.collections.Project.on("status:cleaned-up", () => statuses.push("source"));
  await client.close();
  expect(statuses).toEqual(["query", "source"]);
  expect(query.status).toBe("cleaned-up");
});

test("a device connection lost during reconnect is reported without an unhandled adoption rejection", async () => {
  const laptop = device();
  const client = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(client, "p1", "WEB");
  await laptop.store.read();
  laptop.db.close();
  client.faults.dropStream();
  await eventually(() => expect(client.refused.some((error) => /closed database/i.test(error.message))).toBe(true));
  await client.close();
});

test("a reload shows the stored rows without a bootstrap, then receives what changed, once and in order", async () => {
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  expect(bootstraps(first)).toBe(1);
  await createProject(first, "p1", "WEB");
  await createIssue(first, "i1", "p1", ada.userId);
  await first.close();

  const b = await h.connect(bob, workspaceId);
  await createIssue(b, "i2", "p1", bob.userId);

  const reloaded = await h.connect(ada, workspaceId, { device: laptop });
  // Ready before the stream has delivered anything: the rows came from the device.
  expect(reloaded.collections.Issue.get("i1")?.number).toBe(1);
  expect(bootstraps(reloaded)).toBe(0);
  await eventually(() => expect(reloaded.collections.Issue.get("i2")?.number).toBe(2));
  const server = await h.snapshot(ada, workspaceId);
  await eventually(() => expect(reloaded.workspace.cursor).toBe(server.cursor));
  expect(reloaded.received).toEqual(
    Array.from({ length: server.cursor - first.workspace.cursor }, (_, i) => first.workspace.cursor + 1 + i),
  );
});

test("a workspace opened before opens from the device while the server is unreachable", async () => {
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(first, "p1", "WEB");
  await first.close();
  const offline = await h.connect(ada, workspaceId, { device: laptop, offline: true });
  expect(offline.collections.Project.get("p1")?.identifier).toBe("WEB");
  await eventually(() => expect(offline.workspace.status).toBe("offline"));
});

test("rows stored in another format are dropped and the workspace is loaded again", async () => {
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(first, "p1", "WEB");
  await first.close();
  // What a new version of the app finds: every collection, and its position, stored by an older one.
  laptop.db.run("UPDATE meta SET value = json_set(value, '$.schema', 'older') WHERE key = 'position'");
  const reloaded = await h.connect(ada, workspaceId, { device: laptop });
  expect(bootstraps(reloaded)).toBe(1);
  expect(reloaded.collections.Project.get("p1")?.identifier).toBe("WEB");
  expect(reloaded.collections.State.size).toBe(5);
});

test("a write made offline stays shown, waits on the device and is saved once when the server is back", async () => {
  const laptop = device();
  const a = await h.connect(ada, workspaceId, { device: laptop });
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  const releaseWrites = laptop.holdWrites();
  a.faults.offline = true;
  a.faults.dropStream();
  const saving = a.mutate(() =>
    a.collections.Issue.update("i1", (issue) => {
      issue.priority = "high";
    }),
  );
  await eventually(() => expect(a.collections.Issue.get("i1")?.priority).toBe("high"));
  expect(a.workspace.queued()).toBe(0);
  releaseWrites();
  await eventually(() => expect(a.workspace.queued()).toBe(1));
  a.faults.offline = false;
  await saving;
  expect(a.workspace.queued()).toBe(0);
  await eventually(() => expect(b.collections.Issue.get("i1")?.priority).toBe("high"));
  await loadHistory(b, "i1");
  expect(b.collections.Activity.toArray.filter((x) => x.field === "priority")).toHaveLength(1);
});

test("a write made offline survives a reload and is sent once the server is reachable", async () => {
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(first, "p1", "WEB");
  await createIssue(first, "i1", "p1", ada.userId);
  first.faults.offline = true;
  first.faults.dropStream();
  void first
    .mutate(() =>
      first.collections.Issue.update("i1", (issue) => {
        issue.title = "Written offline";
      }),
    )
    .catch(() => {});
  await eventually(async () => expect(kept(laptop)).toBe(1));
  await first.close();

  const reloaded = await h.connect(ada, workspaceId, { device: laptop, offline: true });
  expect(reloaded.collections.Issue.get("i1")?.title).toBe("Written offline");
  expect(reloaded.workspace.queued()).toBe(1);
  reloaded.faults.offline = false;
  await eventually(async () => {
    expect((await h.snapshot(ada, workspaceId)).rows.Issue[0].title).toBe("Written offline");
    expect(kept(laptop)).toBe(0);
  }, 5000);
  expect(reloaded.collections.Issue.get("i1")?.title).toBe("Written offline");
  expect(reloaded.refused).toEqual([]);
});

test("a kept write the server refuses when it is sent rolls back and says why", async () => {
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  const b = await h.connect(bob, workspaceId);
  await createProject(first, "p1", "WEB");
  await eventually(() => expect(b.collections.Project.get("p1")).toBeDefined());
  await createIssue(b, "i1", "p1", bob.userId);
  await eventually(() => expect(first.collections.Issue.get("i1")).toBeDefined());
  first.faults.offline = true;
  first.faults.dropStream();
  void first
    .mutate(() =>
      first.collections.Issue.update("i1", (issue) => {
        issue.title = "Too late";
      }),
    )
    .catch(() => {});
  await eventually(async () => expect(kept(laptop)).toBe(1));
  await first.close();
  await b.mutate(() => b.collections.Issue.delete("i1"));

  const reloaded = await h.connect(ada, workspaceId, { device: laptop });
  await eventually(() => expect(reloaded.refused.map((e) => e.code)).toEqual(["not_found"]), 5000);
  expect(reloaded.collections.Issue.get("i1")).toBeUndefined();
  await eventually(() => expect(kept(laptop)).toBe(0));
});

test("writes made offline that build on each other are saved in order", async () => {
  const a = await h.connect(ada, workspaceId, { device: device() });
  a.faults.offline = true;
  a.faults.dropStream();
  const project = createProject(a, "p1", "WEB");
  const issue = createIssue(a, "i1", "p1", ada.userId);
  expect(a.collections.Issue.get("i1")?.number).toBe(1);
  await eventually(() => expect(a.workspace.queued()).toBe(2));
  a.faults.offline = false;
  await Promise.all([project, issue]);
  const server = await h.snapshot(ada, workspaceId);
  expect(server.rows.Project.map((p) => p.id)).toEqual(["p1"]);
  expect(server.rows.Issue.map((i) => [i.id, i.number])).toEqual([["i1", 1]]);
});

test("releasing a workspace stops its requests and frees its collections; kept writes wait for the next visit", async () => {
  const laptop = device();
  const first = await h.connect(ada, workspaceId, { device: laptop });
  await createProject(first, "p1", "WEB");
  first.faults.offline = true;
  first.faults.dropStream();
  void createIssue(first, "i1", "p1", ada.userId).catch(() => {});
  await eventually(async () => expect(kept(laptop)).toBe(1));
  await first.close();
  const requests = first.requests();
  first.faults.offline = false;
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(first.requests()).toBe(requests);
  expect(first.collections.Project.status).toBe("cleaned-up");
  expect((await h.snapshot(ada, workspaceId)).rows.Issue).toEqual([]);

  const again = await h.connect(ada, workspaceId, { device: laptop });
  await eventually(async () => expect((await h.snapshot(ada, workspaceId)).rows.Issue).toHaveLength(1), 5000);
  expect(again.collections.Issue.get("i1")?.number).toBe(1);
});

test("a member removed from the workspace keeps nothing of it on the device", async () => {
  const phone = device();
  const b = await h.connect(bob, workspaceId, { device: phone });
  await createProject(b, "p1", "WEB");
  const full = (await (
    await h.request(`/api/auth/organization/get-full-organization?organizationId=${workspaceId}`, {}, ada.cookie)
  ).json()) as { members: { id: string; userId: string }[] };
  const member = full.members.find((m) => m.userId === bob.userId)!;
  await h.post(
    "/api/auth/organization/remove-member",
    { memberIdOrEmail: member.id, organizationId: workspaceId },
    ada.cookie,
  );
  await eventually(() => expect(b.workspace.status).toBe("revoked"));
  await b.close();
  expect(phone.db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([]);
  expect(phone.db.query("SELECT name FROM sqlite_master WHERE name = 'outbox'").all().length).toBe(0);
});

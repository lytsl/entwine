import { afterEach, beforeEach, expect, test } from "bun:test";
import { defaultStates, issueQueries, mentionMarkdown } from "@entwine/shared";
import { type Change, type LoadResponse, type Query, readEvents } from "@entwine/sync-engine/protocol";
import { insert, send } from "../helpers/requests";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

const load = (account: Account, workspaceId: string, queries: Query[]) =>
  account.json<LoadResponse>(`/api/w/${workspaceId}/load`, { queries });

test("transactions must be JSON and at most 1 MB", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const project = [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
  ];
  const text = await send(ada, id, project, { headers: { "Content-Type": "text/plain" } });
  expect(text.status).toBe(415);
  expect(await text.json()).toMatchObject({ code: "invalid" });
  const huge = await send(ada, id, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "x".repeat(1024 * 1024) }),
  ]);
  expect(huge.status).toBe(413);
  expect(await huge.json()).toMatchObject({ code: "invalid" });
  expect((await send(ada, id, project)).status).toBe(200);
});

/** The notifications whose changes a member's stream carries, from the start of the log to `cursor`. */
async function streamed(account: Account, workspaceId: string, cursor: number): Promise<string[]> {
  const { epoch } = await load(account, workspaceId, [{ model: "Member" }]);
  const response = await account.fetch(`/api/w/${workspaceId}/stream?epoch=${epoch}&after=0`);
  const changes: Change[] = [];
  for await (const event of readEvents(response.body!)) {
    if (event.event === "changes") changes.push(...(JSON.parse(event.data) as Change[]));
    if (Number(event.id) >= cursor) break;
  }
  await response.body!.cancel().catch(() => {});
  return changes.filter((change) => change.model === "Notification").map((change) => change.rowId);
}

test("a notification is its member's alone: in loads, on the stream and in writes", async () => {
  const [ada, bob, cy] = [await t.signUp("ada"), await t.signUp("bob"), await t.signUp("cy")];
  const id = await t.workspace(ada, "acme", [
    [bob, "admin"],
    [cy, "member"],
  ]);
  const created = await send(ada, id, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
    insert("Issue", { id: "i1", projectId: "p1", title: "Private", stateId: "p1:backlog", assigneeId: bob.id }),
  ]);
  const { cursor } = (await created.json()) as { cursor: number };

  const notifications = async (account: Account, query: Query = { model: "Notification" }) =>
    (await load(account, id, [query])).rows.Notification as unknown as { id: string; memberId: string }[];
  const [mine] = await notifications(bob);
  expect(mine).toMatchObject({ memberId: bob.id, issueId: "i1", actorId: ada.id, kind: "assigned", readAt: null });
  for (const other of [ada, cy]) {
    for (const where of [undefined, { memberId: bob.id }, { id: mine.id }, { issueId: "i1" }])
      expect(await notifications(other, { model: "Notification", where } as Query)).toEqual([]);
    // Nor by what a notification points to.
    const through = { model: "Issue", where: { id: { model: "Notification", select: "issueId" } } };
    expect((await load(other, id, [through])).rows.Issue).toEqual([]);
    const marked = await send(other, id, [
      { model: "Notification", type: "update", key: mine.id, value: { readAt: 1 } },
    ]);
    expect(marked.status).toBe(404);
  }

  // Each stream reaches the end of the log; only Bob's carries the notification.
  expect(await streamed(bob, id, cursor)).toEqual([mine.id]);
  expect(await streamed(ada, id, cursor)).toEqual([]);
  expect(await streamed(cy, id, cursor)).toEqual([]);

  expect(
    (await send(bob, id, [{ model: "Notification", type: "update", key: mine.id, value: { readAt: 1 } }])).status,
  ).toBe(200);
  expect((await notifications(bob))[0]).toMatchObject({ readAt: expect.any(Number) });
});

test("an undo and its redo move another member's notification on that member's stream alone", async () => {
  const [ada, bob, cy] = [await t.signUp("ada"), await t.signUp("bob"), await t.signUp("cy")];
  const id = await t.workspace(ada, "acme", [
    [bob, "member"],
    [cy, "member"],
  ]);
  await send(ada, id, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
    insert("Issue", { id: "i1", projectId: "p1", title: "Private", stateId: "p1:backlog" }),
  ]);
  const post = (body: object, account = ada) => send(account, id, [], { body: JSON.stringify(body) });
  const mention = insert("Comment", { id: "c1", issueId: "i1", body: mentionMarkdown(bob.id, "Bob") });
  expect((await post({ id: "say", mutations: [mention] })).status).toBe(200);
  const mine = async () =>
    (await load(bob, id, [{ model: "Notification" }])).rows.Notification as unknown as { id: string }[];
  const [told] = await mine();
  expect((await post({ id: "undo", revert: "say" })).status).toBe(200);
  expect(await mine()).toEqual([]);
  const redone = await post({ id: "redo", revert: "undo" });
  const { cursor } = (await redone.json()) as { cursor: number };
  expect(await mine()).toEqual([told]);

  // Written, deleted and written again: three changes for Bob, and for nobody else.
  expect(await streamed(bob, id, cursor)).toEqual([told.id, told.id, told.id]);
  expect(await streamed(ada, id, cursor)).toEqual([]);
  expect(await streamed(cy, id, cursor)).toEqual([]);
  // Nor may the member whose change it was undo what Bob did with it.
  const read = { model: "Notification", type: "update", key: told.id, value: { readAt: 1 } };
  expect((await post({ id: "read", mutations: [read] }, bob)).status).toBe(200);
  expect((await post({ id: "unread", revert: "read" })).status).toBe(403);
  expect((await mine())[0]).toMatchObject({ readAt: expect.any(Number) });
});

test("loads need membership, and answer the rows their queries ask for", async () => {
  const ada = await t.signUp("ada");
  const eve = await t.signUp("eve");
  const id = await t.workspace(ada, "acme");
  for (const project of ["p1", "p2"])
    await send(ada, id, [
      insert("Project", { id: project, name: project, identifier: project.toUpperCase(), description: "" }),
      ...defaultStates(project).map((s) => insert("State", s)),
      insert("Issue", { id: `${project}-issue`, projectId: project, title: project, stateId: `${project}:backlog` }),
    ]);
  await send(ada, id, [insert("Comment", { id: "c1", issueId: "p2-issue", body: "hello" })]);

  const path = `/api/w/${id}/load`;
  const body = { method: "POST", body: JSON.stringify({ queries: [{ model: "Issue" }] }) };
  expect((await t.request(path, body)).status).toBe(401);
  expect((await eve.fetch(path, body)).status).toBe(403);
  expect((await ada.fetch(path, { ...body, headers: { "Content-Type": "text/plain" } })).status).toBe(415);

  const comments = await load(ada, id, [{ model: "Comment", where: { issueId: "p2-issue" } }]);
  expect(comments.rows.Comment.map((c) => c.id)).toEqual(["c1"]);
  expect(comments.cursor).toBeGreaterThan(0);
  const project = await load(ada, id, issueQueries({ projectId: "p1" }));
  expect(project.rows.Issue.map((i) => i.id)).toEqual(["p1-issue"]);
  expect(await load(ada, id, issueQueries({ issueId: "p1-issue" }))).toEqual(project);
  for (const queries of [[{ model: "change" }], [{ model: "Nope" }], [{ model: "Issue", where: { nope: 1 } }]])
    expect((await ada.fetch(path, { method: "POST", body: JSON.stringify({ queries }) })).status).toBe(400);
});

test("a saved schedule is carried out before the answer, and again when the workspace is used on a later day", async () => {
  await t.cleanup();
  let clock = Date.parse("2026-10-14T12:00:00Z");
  t = await testServer({ now: () => clock });
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const cycles = async () =>
    (await load(ada, id, [{ model: "Cycle" }])).rows.Cycle.map((c) =>
      String((c as { startDate?: string }).startDate),
    ).sort();
  await send(ada, id, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
  ]);
  expect(await cycles()).toEqual([]);
  const saved = await send(ada, id, [{ model: "Project", type: "update", key: "p1", value: { cycleWeeks: 1 } }]);
  expect(saved.status).toBe(200);
  expect(await cycles()).toEqual(["2026-10-19", "2026-10-26"]);
  // Within the quarter hour nothing is planned again; the next day's first request is.
  clock += 60_000;
  expect(await cycles()).toHaveLength(2);
  clock = Date.parse("2026-10-19T00:00:01Z");
  expect(await cycles()).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
  // An archived project is skipped, and owed its cycles as soon as it is restored: no later request plans this
  // quarter hour again.
  const archive = (archivedAt: number | null) =>
    send(ada, id, [{ model: "Project", type: "update", key: "p1", value: { archivedAt } }]);
  await archive(1);
  clock = Date.parse("2026-10-26T00:00:01Z");
  expect(await cycles()).toHaveLength(3);
  expect((await archive(null)).status).toBe(200);
  expect(await cycles()).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"]);
  // So is a deleted project that comes back with its schedule.
  const transactions = (body: object) => send(ada, id, [], { body: JSON.stringify(body) });
  await transactions({ id: "gone", mutations: [{ model: "Project", type: "delete", key: "p1", value: {} }] });
  clock = Date.parse("2026-11-02T00:00:01Z");
  expect(await cycles()).toEqual([]);
  expect((await transactions({ id: crypto.randomUUID(), revert: "gone" })).status).toBe(200);
  expect(await cycles()).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16"]);
});

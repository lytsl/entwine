import { afterEach, beforeEach, expect, test } from "bun:test";
import { mentionMarkdown, NOTIFICATION_LIMIT, pairId, type Row } from "@entwine/shared";
import { createIssue, createProject, type Fixture, fixture, insert, remove, update } from "../../helpers/tenant";

let f: Fixture;
/** Ada's issue i1, which Cy follows too. */
beforeEach(async () => {
  f = await fixture();
  await f.send(createProject("p1", "WEB"));
  await f.send([createIssue("i1", "p1")]);
  await f.send([insert("IssueSubscription", { id: pairId("i1", "cy"), issueId: "i1", memberId: "cy" })], "cy");
});
afterEach(() => f.cleanup());

/** As the server reads them: everyone's. */
const all = async () => (await f.tenant.load([{ model: "Notification" }])).rows.Notification as Row<"Notification">[];
const told = async () =>
  (await all()).map((n) => `${n.actorId} ${n.kind} ${n.issueId} -> ${n.memberId}${n.readAt ? " (read)" : ""}`).sort();
const comment = (id: string, body = "Hello") => insert("Comment", { id, issueId: "i1", body });
const at = (id: string, name = id) => mentionMarkdown(id, name);

test("a comment notifies the issue's subscribers, and not its author", async () => {
  await f.send([comment("c1")], "bob");
  expect(await told()).toEqual(["bob commented i1 -> ada", "bob commented i1 -> cy"]);
  const [first] = await all();
  expect(first).toMatchObject({ readAt: null, createdAt: expect.any(Number) });
  // Bob follows the issue now, so Ada's answer reaches him.
  await f.send([comment("c2")], "ada");
  expect((await told()).filter((line) => line.startsWith("ada"))).toEqual([
    "ada commented i1 -> bob",
    "ada commented i1 -> cy",
  ]);
});

test("the assignee is told once of an edit that assigns and moves the issue; subscribers of the state", async () => {
  await f.send([update("Issue", "i1", { assigneeId: "bob", stateId: "p1:started" })]);
  expect(await told()).toEqual(["ada assigned i1 -> bob", "ada state i1 -> cy"]);
  // An issue made with an assignee and a mention tells each once.
  await f.send([createIssue("i2", "p1", { assigneeId: "bob", description: `For ${at("bob")} and ${at("cy")}` })]);
  expect((await told()).filter((line) => line.includes("i2"))).toEqual([
    "ada assigned i2 -> bob",
    "ada mentioned i2 -> cy",
  ]);
});

test("a mention notifies the mentioned, and an edit only those it adds", async () => {
  await f.send([comment("c1", `Ask ${at("bob", "Bob")}, ${at("ada")} or ${at("nobody")}`)], "ada");
  expect(await told()).toEqual(["ada commented i1 -> cy", "ada mentioned i1 -> bob"]);
  await f.send([update("Comment", "c1", { body: `Ask ${at("bob", "Robert")} and ${at("cy")}` })], "ada");
  expect(await told()).toEqual(["ada commented i1 -> cy", "ada mentioned i1 -> bob", "ada mentioned i1 -> cy"]);
  await f.send([update("Issue", "i1", { description: `See ${at("bob")}` })], "cy");
  await f.send([update("Issue", "i1", { description: `See ${at("bob")} again` })], "cy");
  expect((await told()).filter((line) => line.startsWith("cy"))).toEqual(["cy mentioned i1 -> bob"]);
});

test("a mention written out in code addresses nobody: it neither notifies nor subscribes", async () => {
  await f.send([comment("c1", `Type \`${at("bob")}\` or\n\n\`\`\`\n${at("bob")}\n\`\`\``)], "ada");
  expect(await told()).toEqual(["ada commented i1 -> cy"]);
  expect(await f.tenant.load([{ model: "IssueSubscription", where: { memberId: "bob" } }])).toMatchObject({
    rows: { IssueSubscription: [] },
  });
  // Taken out of the code, it is a mention the text did not have.
  await f.send([update("Comment", "c1", { body: `Type ${at("bob")}` })], "ada");
  expect(await told()).toEqual(["ada commented i1 -> cy", "ada mentioned i1 -> bob"]);
});

test("other fields notify nobody, and neither does a member who left get told", async () => {
  await f.send([update("Issue", "i1", { priority: "high", dueDate: "2026-12-01", title: "Renamed" })], "bob");
  await f.send([insert("Label", { id: "l1", name: "Bug", color: "#ff0000" })], "bob");
  await f.send([insert("IssueLabel", { id: "i1:l1", issueId: "i1", labelId: "l1" })], "bob");
  expect(await told()).toEqual([]);
  await f.tenant.write((w) => w.update("Member", "cy", { removed: 1 }));
  await f.send([comment("c1", `Bye ${at("cy")}`)], "bob");
  expect(await told()).toEqual(["bob commented i1 -> ada"]);
});

test("a refused change writes none of its notifications", async () => {
  const refused = await f.send([update("Issue", "i1", { stateId: "p1:started" }), comment("c1", "   ")], "bob");
  expect(refused.status).toBe(400);
  expect(await told()).toEqual([]);
});

test("its member marks a notification read and unread; nobody else writes it, and no client makes or deletes one", async () => {
  await f.send([comment("c1")], "bob");
  const mine = (await all()).find((n) => n.memberId === "ada")!;
  expect(await f.send([update("Notification", mine.id, { readAt: 1 })], "cy")).toMatchObject({
    status: 404,
    body: { code: "not_found" },
  });
  expect((await f.send([remove("Notification", mine.id)], "cy")).status).toBe(404);
  expect((await all()).find((n) => n.id === mine.id)).toEqual(mine);

  expect((await f.send([update("Notification", mine.id, { readAt: 1 })])).status).toBe(200);
  // The time is the server's.
  expect((await all()).find((n) => n.id === mine.id)!.readAt).toBeGreaterThan(1);
  expect((await f.send([update("Notification", mine.id, { readAt: null })])).status).toBe(200);
  expect((await all()).find((n) => n.id === mine.id)).toEqual(mine);

  for (const value of [{ memberId: "cy" }, { kind: "assigned" }, { readAt: 1, issueId: "i1" }])
    expect((await f.send([update("Notification", mine.id, value)])).status).toBe(400);
  expect((await f.send([remove("Notification", mine.id)])).status).toBe(403);
  for (const memberId of ["ada", "bob"]) {
    const forged = { ...mine, id: crypto.randomUUID(), memberId };
    expect((await f.send([insert("Notification", forged)])).status).toBe(403);
  }
  expect(await told()).toEqual(["bob commented i1 -> ada", "bob commented i1 -> cy"]);
});

test("a member keeps their newest notifications; the oldest makes room", async () => {
  await f.send([remove("IssueSubscription", pairId("i1", "cy"))], "cy");
  await f.send([comment("first")], "bob");
  const oldest = (await all())[0];
  await new Promise((resolve) => setTimeout(resolve, 5));
  await f.send(
    Array.from({ length: NOTIFICATION_LIMIT - 1 }, (_, i) => comment(`c${i}`)),
    "bob",
  );
  expect(await all()).toHaveLength(NOTIFICATION_LIMIT);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await f.send([comment("last")], "bob");
  const kept = await all();
  expect(kept).toHaveLength(NOTIFICATION_LIMIT);
  expect(kept.some((n) => n.id === oldest.id)).toBe(false);
  expect(kept.every((n) => n.memberId === "ada")).toBe(true);
});

test("deleting an issue deletes its notifications and subscriptions, through the change log", async () => {
  await f.send([comment("c1")], "bob");
  const before = (await f.tenant.log()).cursor;
  await f.send([remove("Issue", "i1")]);
  expect(await all()).toEqual([]);
  expect((await f.tenant.load([{ model: "IssueSubscription" }])).rows.IssueSubscription).toEqual([]);
  const deleted = (await f.tenant.changesAfter(before))!.filter((c) => c.data === null).map((c) => c.model);
  expect(deleted.filter((m) => m === "Notification")).toHaveLength(2);
  expect(deleted.filter((m) => m === "IssueSubscription")).toHaveLength(3);
});

test("undoing a change takes its notifications back and tells nobody; redoing brings them back as they were", async () => {
  await f.send([comment("c1")], "bob", "member", "comment");
  expect(await told()).toHaveLength(2);
  expect((await f.revert("comment", "undo-comment", "bob")).status).toBe(200);
  expect(await told()).toEqual([]);

  await f.send([update("Issue", "i1", { stateId: "p1:started" })], "bob", "member", "move");
  const mine = (await all()).find((n) => n.memberId === "ada")!;
  await f.send([update("Notification", mine.id, { readAt: 1 })]);
  expect((await f.revert("move", "undo-move", "bob")).status).toBe(200);
  expect(await told()).toEqual([]);
  expect((await f.revert("undo-move", "redo-move", "bob")).status).toBe(200);
  expect(await told()).toEqual(["bob state i1 -> ada (read)", "bob state i1 -> cy"]);
});

test("an undo is not refused for a notification it pushed out of a full inbox, whose issue is gone since", async () => {
  await f.send([remove("IssueSubscription", pairId("i1", "cy"))], "cy");
  await f.send([createIssue("i2", "p1")]);
  await f.send([insert("Comment", { id: "old", issueId: "i2", body: "Hello" })], "bob");
  await new Promise((resolve) => setTimeout(resolve, 5));
  await f.send(
    Array.from({ length: NOTIFICATION_LIMIT - 1 }, (_, i) => comment(`c${i}`)),
    "bob",
  );
  await f.send([comment("last")], "bob", "member", "last");
  expect((await all()).some((n) => n.issueId === "i2")).toBe(false);
  await f.send([remove("Issue", "i2")]);
  expect(await f.revert("last", "undo-last", "bob")).toMatchObject({ status: 200 });
  const kept = await all();
  expect(kept).toHaveLength(NOTIFICATION_LIMIT - 1);
  expect(kept.every((n) => n.issueId === "i1")).toBe(true);
});

import { afterEach, beforeEach, expect, test } from "bun:test";
import { mentionMarkdown, pairId, type Row } from "@entwine/shared";
import { createIssue, createProject, type Fixture, fixture, insert, remove, update } from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
  await f.send(createProject("p1", "WEB"));
});
afterEach(() => f.cleanup());

const subscribers = async (issueId = "i1") =>
  (
    (await f.tenant.load([{ model: "IssueSubscription", where: { issueId } }])).rows
      .IssueSubscription as Row<"IssueSubscription">[]
  )
    .map((s) => s.memberId)
    .sort();
const notified = async () =>
  ((await f.tenant.load([{ model: "Notification" }])).rows.Notification as Row<"Notification">[])
    .map((n) => `${n.kind} -> ${n.memberId}`)
    .sort();
const subscription = (memberId: string, issueId = "i1") =>
  insert("IssueSubscription", { id: pairId(issueId, memberId), issueId, memberId });
const comment = (id: string, body = "Hello") => insert("Comment", { id, issueId: "i1", body });

test("the creator, the assignee, a commenter and the mentioned follow the issue, each once", async () => {
  await f.send([createIssue("i1", "p1", { assigneeId: "bob" })]);
  expect(await subscribers()).toEqual(["ada", "bob"]);
  await f.send([createIssue("i2", "p1")], "bob");
  await f.send([insert("Comment", { id: "c0", issueId: "i2", body: `Ask ${mentionMarkdown("ada", "Ada")}` })], "cy");
  expect(await subscribers("i2")).toEqual(["ada", "bob", "cy"]);
  await f.send([comment("c1"), comment("c2")], "bob");
  await f.send([update("Issue", "i1", { assigneeId: "cy" })], "bob");
  expect(await subscribers()).toEqual(["ada", "bob", "cy"]);
  // A member who left, and an id that is nobody's, follow nothing.
  await f.tenant.write((w) => w.update("Member", "cy", { removed: 1 }));
  await f.send([
    createIssue("i3", "p1", { description: `${mentionMarkdown("cy", "Cy")} ${mentionMarkdown("x", "X")}` }),
  ]);
  expect(await subscribers("i3")).toEqual(["ada"]);
});

test("unsubscribing lasts through what others do, until the member is mentioned or assigned", async () => {
  await f.send([createIssue("i1", "p1", { assigneeId: "bob" })]);
  expect((await f.send([remove("IssueSubscription", pairId("i1", "bob"))], "bob")).status).toBe(200);
  await f.send([comment("c1"), update("Issue", "i1", { stateId: "p1:started", priority: "high" })]);
  await f.send([comment("c2")], "cy");
  expect(await subscribers()).toEqual(["ada", "cy"]);
  expect((await notified()).filter((line) => line.endsWith("bob"))).toEqual(["assigned -> bob"]);

  await f.send([comment("c3", `Back to ${mentionMarkdown("bob", "Bob")}`)]);
  expect(await subscribers()).toEqual(["ada", "bob", "cy"]);
  expect((await notified()).filter((line) => line.endsWith("bob"))).toEqual(["assigned -> bob", "mentioned -> bob"]);

  // Their own comment subscribes them again as well.
  await f.send([remove("IssueSubscription", pairId("i1", "cy"))], "cy");
  await f.send([comment("c4")], "cy");
  expect(await subscribers()).toEqual(["ada", "bob", "cy"]);
});

test("a member subscribes and unsubscribes only themselves", async () => {
  await f.send([createIssue("i1", "p1")]);
  expect((await f.send([subscription("cy")], "bob")).status).toBe(403);
  expect((await f.send([remove("IssueSubscription", pairId("i1", "ada"))], "bob")).status).toBe(403);
  expect((await f.send([insert("IssueSubscription", { id: "x", issueId: "i1", memberId: "bob" })], "bob")).status).toBe(
    400,
  );
  expect((await f.send([subscription("bob", "missing")], "bob")).status).toBe(404);
  expect((await f.send([subscription("bob")], "bob")).status).toBe(200);
  expect((await f.send([subscription("bob")], "bob")).status).toBe(409);
  expect(await subscribers()).toEqual(["ada", "bob"]);
});

test("undoing a change removes the subscriptions it made, and redoing makes them again", async () => {
  await f.send([createIssue("i1", "p1")]);
  await f.send([update("Issue", "i1", { assigneeId: "bob" })], "ada", "owner", "assign");
  expect(await subscribers()).toEqual(["ada", "bob"]);
  expect((await f.revert("assign", "undo")).status).toBe(200);
  expect(await subscribers()).toEqual(["ada"]);
  expect(await notified()).toEqual([]);
  // Bob subscribed himself meanwhile: the redo finds him subscribed.
  await f.send([subscription("bob")], "bob");
  expect((await f.revert("undo", "redo")).status).toBe(200);
  expect(await subscribers()).toEqual(["ada", "bob"]);
  expect(await notified()).toEqual(["assigned -> bob"]);
});

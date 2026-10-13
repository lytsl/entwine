import { afterEach, beforeEach, expect, test } from "bun:test";
import { type Row, reactionId } from "@entwine/shared";
import { createIssue, createProject, type Fixture, fixture, insert, remove, update } from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
  await f.send(createProject("p1", "WEB"));
  await f.send([createIssue("i1", "p1"), createIssue("i2", "p1")]);
  await f.send([insert("Comment", { id: "c1", issueId: "i1", body: "hello" })], "bob");
});
afterEach(() => f.cleanup());

const reactions = async () =>
  (((await f.tenant.load([{ model: "Reaction" }])).rows.Reaction ?? []) as unknown as Row<"Reaction">[]).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
const react = (userId: string, emoji: string, commentId: string | null = null, issueId = "i1") =>
  insert("Reaction", { id: reactionId(commentId ?? issueId, userId, emoji), issueId, commentId, emoji });

test("a member reacts to an issue and to a comment, as themselves, and takes it back", async () => {
  expect((await f.send([react("bob", "👍"), react("bob", "🎉", "c1")], "bob")).status).toBe(200);
  expect((await reactions()).map((r) => [r.commentId, r.userId, r.emoji])).toEqual([
    ["c1", "bob", "🎉"],
    [null, "bob", "👍"],
  ]);
  // Loaded with the issue's page, by its issue.
  const loaded = await f.tenant.load([{ model: "Reaction", where: { issueId: "i1" } }]);
  expect(loaded.rows.Reaction).toHaveLength(2);
  expect((await f.send([remove("Reaction", reactionId("i1", "bob", "👍"))], "bob")).status).toBe(200);
  expect((await reactions()).map((r) => r.emoji)).toEqual(["🎉"]);
});

test("once per emoji and target; the emoji is one of the set; the id is the sender's", async () => {
  await f.send([react("bob", "👍", "c1")], "bob");
  expect((await f.send([react("bob", "👍", "c1")], "bob")).status).toBe(409);
  expect((await f.send([react("bob", "👎", "c1")], "bob")).status).toBe(200);
  expect((await f.send([react("cy", "👍", "c1")], "cy")).status).toBe(200);
  expect((await f.send([react("bob", "💩")], "bob")).status).toBe(400);
  // Another member's id, an id of another target, and a comment of another issue.
  expect((await f.send([react("cy", "👀")], "bob")).status).toBe(400);
  expect(
    (await f.send([insert("Reaction", { id: reactionId("i2", "bob", "👀"), issueId: "i1", emoji: "👀" })], "bob"))
      .status,
  ).toBe(400);
  expect((await f.send([react("bob", "👀", "c1", "i2")], "bob")).status).toBe(400);
  expect((await f.send([react("bob", "👀", "gone")], "bob")).status).toBe(404);
  expect(await reactions()).toHaveLength(3);
});

test("only the member who reacted removes a reaction, and none is edited", async () => {
  await f.send([react("bob", "👍")], "bob");
  const id = reactionId("i1", "bob", "👍");
  expect((await f.send([remove("Reaction", id)], "cy")).status).toBe(403);
  expect((await f.send([remove("Reaction", id)], "ada", "owner")).status).toBe(403);
  expect((await f.send([update("Reaction", id, { emoji: "👎" })], "bob")).status).toBe(403);
  expect(await reactions()).toHaveLength(1);
});

test("an archived issue takes no reactions and keeps the ones it has", async () => {
  await f.send([react("bob", "👍"), react("bob", "👍", "c1")], "bob");
  await f.send([update("Issue", "i1", { stateId: "p1:completed" })]);
  await f.send([update("Issue", "i1", { archivedAt: 1 })]);
  expect((await f.send([react("cy", "👍")], "cy")).status).toBe(400);
  expect((await f.send([react("cy", "👍", "c1")], "cy")).status).toBe(400);
  expect((await f.send([remove("Reaction", reactionId("i1", "bob", "👍"))], "bob")).status).toBe(400);
  expect(await reactions()).toHaveLength(2);
});

test("a deleted comment takes its reactions with it, in the change log", async () => {
  await f.send([react("bob", "👍"), react("bob", "👍", "c1")], "bob");
  await f.send([react("cy", "🎉", "c1")], "cy");
  const { cursor } = await f.tenant.log();
  expect((await f.send([remove("Comment", "c1")], "bob")).status).toBe(200);
  expect((await reactions()).map((r) => r.id)).toEqual([reactionId("i1", "bob", "👍")]);
  const deleted = (await f.tenant.changesAfter(cursor))!.filter((c) => c.model === "Reaction" && c.data === null);
  expect(deleted.map((c) => c.rowId).sort()).toEqual(
    [reactionId("c1", "bob", "👍"), reactionId("c1", "cy", "🎉")].sort(),
  );
});

test("a deleted issue takes every reaction with it, and undoing the deletion restores them", async () => {
  await f.send([react("bob", "👍"), react("bob", "🎉", "c1")], "bob");
  const before = await reactions();
  const { cursor } = await f.tenant.log();
  expect((await f.send([remove("Issue", "i1")], "ada", "owner", "delete")).status).toBe(200);
  expect(await reactions()).toEqual([]);
  const changes = (await f.tenant.changesAfter(cursor))!;
  expect(changes.filter((c) => c.model === "Reaction" && c.data === null)).toHaveLength(2);
  expect((await f.revert("delete")).status).toBe(200);
  expect(await reactions()).toEqual(before);
});

test("a reaction is undone by its member", async () => {
  await f.send([react("bob", "👍")], "bob", "member", "react");
  expect((await f.revert("react", "undo", "bob")).status).toBe(200);
  expect(await reactions()).toEqual([]);
  expect((await f.revert("undo", "redo", "bob")).status).toBe(200);
  expect(await reactions()).toHaveLength(1);
});

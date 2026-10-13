/** An issue's reactions: loaded when the issue is opened, followed live, undone like any edit. */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { reactionId } from "@entwine/shared";
import { createLiveQueryCollection, eq } from "@tanstack/db";
import type { Client } from "./helpers/client";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";

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

const react = (client: Client, userId: string, issueId: string, commentId: string | null, emoji: "👍" | "🎉") =>
  client.mutate(() =>
    client.collections.Reaction.insert({
      id: reactionId(commentId ?? issueId, userId, emoji),
      issueId,
      commentId,
      userId,
      emoji,
      createdAt: now,
    }),
  );

/** As the issue's page does: a live query by issue, kept open. */
async function openReactions(client: Client, issueId: string) {
  const query = createLiveQueryCollection((q) =>
    q.from({ r: client.collections.Reaction }).where(({ r }) => eq(r.issueId, issueId)),
  );
  await query.toArrayWhenReady();
  return query;
}

test("reactions load with their issue, reach other members live, and are undone for everyone", async () => {
  const b = await h.connect(bob, workspaceId);
  await createProject(b, "p1", "WEB");
  await createIssue(b, "i1", "p1", bob.userId);
  await createIssue(b, "i2", "p1", bob.userId);
  await b.mutate(() =>
    b.collections.Comment.insert({
      id: "c1",
      issueId: "i1",
      authorId: bob.userId,
      body: "hello",
      createdAt: now,
      updatedAt: now,
      editedAt: null,
    }),
  );
  await react(b, bob.userId, "i1", null, "👍");
  await react(b, bob.userId, "i2", null, "👍");

  const a = await h.connect(ada, workspaceId);
  expect(a.collections.Reaction.size).toBe(0);
  const open = await openReactions(a, "i1");
  expect(a.collections.Reaction.toArray.map((r) => r.id)).toEqual([reactionId("i1", bob.userId, "👍")]);

  await react(b, bob.userId, "i1", "c1", "🎉");
  await eventually(() => expect(open.toArray.map((r) => r.commentId).sort()).toEqual(["c1", null].sort()));

  await react(a, ada.userId, "i1", "c1", "🎉");
  const mine = reactionId("c1", ada.userId, "🎉");
  await eventually(() => expect(b.collections.Reaction.has(mine)).toBe(true));
  await a.workspace.history.undo();
  await eventually(() => expect(b.collections.Reaction.has(mine)).toBe(false));
  expect(a.collections.Reaction.has(mine)).toBe(false);

  // The comment's reactions go with it, on every client.
  await b.mutate(() => b.collections.Comment.delete("c1"));
  await eventually(() => expect(open.toArray.map((r) => r.commentId)).toEqual([null]));
  await open.cleanup();
});

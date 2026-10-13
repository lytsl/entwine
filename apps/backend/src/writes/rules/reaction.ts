import { reactionId, reactionRow } from "@entwine/shared";
import { editable, need } from "./shared/guards";
import { fail, parse, type Rule } from "./shared/rule";

const input = reactionRow
  .pick({ id: true, issueId: true, emoji: true })
  .extend({ commentId: reactionRow.shape.commentId.optional() });

/** Never updated: a member reacts, or takes the reaction back. */
export const reaction: Rule<"Reaction"> = {
  async insert(ctx, value) {
    const { commentId = null, ...row } = parse(input, value);
    await editable(ctx, row.issueId);
    if (commentId && (await need(ctx, "Comment", commentId)).issueId !== row.issueId)
      fail("invalid", "The comment belongs to another issue");
    // The id is what makes a second identical reaction a conflict, so it is not the client's to choose.
    if (row.id !== reactionId(commentId ?? row.issueId, ctx.userId, row.emoji))
      fail("invalid", "A reaction's id is its target, its member and its emoji");
    return { ...row, commentId, userId: ctx.userId, createdAt: ctx.now };
  },
  async delete(ctx, current) {
    if (current.userId !== ctx.userId) fail("forbidden", "Only the member who reacted can remove a reaction");
    await editable(ctx, current.issueId);
  },
};

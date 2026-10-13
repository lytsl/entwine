import { commentRow } from "@entwine/shared";
import { editable } from "./shared/guards";
import { newMentions, tell } from "./shared/notify";
import { changed, fail, isAdmin, parse, type Rule } from "./shared/rule";

export const comment: Rule<"Comment"> = {
  async insert(ctx, value) {
    const input = parse(commentRow.pick({ id: true, issueId: true, body: true }), value);
    await editable(ctx, input.issueId);
    return { ...input, authorId: ctx.userId, createdAt: ctx.now, updatedAt: ctx.now, editedAt: null };
  },
  async afterInsert(ctx, row) {
    await tell(ctx, row.issueId, { actor: true, mentioned: newMentions(row.body), subscribers: "commented" });
  },
  async update(ctx, current, value) {
    if (current.authorId !== ctx.userId) fail("forbidden", "Only its author can edit a comment");
    await editable(ctx, current.issueId);
    const patch = changed(current, parse(commentRow.pick({ body: true }).partial(), value));
    if (patch.body) await tell(ctx, current.issueId, { mentioned: newMentions(patch.body, current.body) });
    return Object.keys(patch).length ? { ...patch, updatedAt: ctx.now, editedAt: ctx.now } : patch;
  },
  async delete(ctx, current) {
    if (current.authorId !== ctx.userId && !isAdmin(ctx))
      fail("forbidden", "Only its author or an admin can delete a comment");
    await editable(ctx, current.issueId);
    for (const reaction of await ctx.writer.list("Reaction", { commentId: current.id }))
      await ctx.writer.delete("Reaction", reaction.id);
  },
};

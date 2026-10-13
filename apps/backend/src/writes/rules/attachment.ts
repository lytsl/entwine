import { attachmentRow } from "@entwine/shared";
import { editable } from "./shared/guards";
import { fail, isAdmin, parse, type Rule } from "./shared/rule";

/**
 * The bytes are uploaded first, under the row's id. A row is written only while its file is stored, and by the
 * member who stored it, so the two cannot disagree; a file whose row is deleted is kept for a while, since the deletion can be undone.
 */
export const attachment: Rule<"Attachment"> = {
  async restore(ctx, row) {
    if ((await ctx.files.size(row.id)) === null) fail("conflict", "The file is gone; it can no longer be undone");
  },
  async insert(ctx, value) {
    const input = parse(attachmentRow.pick({ id: true, issueId: true, name: true }), value);
    await editable(ctx, input.issueId);
    const size = (await ctx.files.size(input.id)) ?? fail("invalid", "The file was not uploaded");
    // Also what keeps a removed attachment's bytes, kept for an undo, from being attached again by someone else.
    if ((await ctx.files.uploader(input.id)) !== ctx.userId)
      fail("forbidden", "Only the member who uploaded a file can attach it");
    return { ...input, size, uploaderId: ctx.userId, createdAt: ctx.now };
  },
  async delete(ctx, current) {
    if (current.uploaderId !== ctx.userId && !isAdmin(ctx))
      fail("forbidden", "Only its uploader or an admin can remove an attachment");
    await editable(ctx, current.issueId);
    await ctx.files.release(current.id);
  },
};

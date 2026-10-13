import { issueLinkRow } from "@entwine/shared";
import { logActivity } from "./shared/activity";
import { editable } from "./shared/guards";
import { changed, parse, type Rule } from "./shared/rule";

const linkFields = issueLinkRow.pick({ url: true, title: true });

export const issueLink: Rule<"IssueLink"> = {
  async insert(ctx, value) {
    const input = parse(
      linkFields.partial({ title: true }).extend({ id: issueLinkRow.shape.id, issueId: issueLinkRow.shape.issueId }),
      value,
    );
    await editable(ctx, input.issueId);
    await logActivity(ctx, input.issueId, "link", null, input.url);
    return { title: "", ...input, creatorId: ctx.userId, createdAt: ctx.now };
  },
  async update(ctx, current, value) {
    const patch = changed(current, parse(linkFields.partial(), value));
    if (Object.keys(patch).length) await editable(ctx, current.issueId);
    return patch;
  },
  async delete(ctx, current) {
    await editable(ctx, current.issueId);
    await logActivity(ctx, current.issueId, "link", current.url, null);
  },
};

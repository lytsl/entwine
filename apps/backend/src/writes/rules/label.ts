import { issueLabelRow, labelNameKey, labelRow, pairId } from "@entwine/shared";
import { logActivity } from "./shared/activity";
import { editable, need } from "./shared/guards";
import { changed, fail, parse, type Rule, type WriteContext } from "./shared/rule";

const labelFields = labelRow.pick({ name: true, color: true });

async function uniqueLabelName(ctx: WriteContext, name: string, id: string): Promise<string> {
  const nameKey = labelNameKey(name);
  const [other] = await ctx.writer.list("Label", { nameKey });
  if (other && other.id !== id) fail("conflict", `Label ${name} already exists`);
  return nameKey;
}

export const label: Rule<"Label"> = {
  restore: (ctx, row) => uniqueLabelName(ctx, row.name, row.id),
  async insert(ctx, value) {
    const input = parse(labelFields.extend({ id: labelRow.shape.id }), value);
    return { ...input, nameKey: await uniqueLabelName(ctx, input.name, input.id), createdAt: ctx.now };
  },
  async update(ctx, current, value) {
    const patch = changed(current, parse(labelFields.partial(), value));
    return patch.name ? { ...patch, nameKey: await uniqueLabelName(ctx, patch.name, current.id) } : patch;
  },
  async delete(ctx, current) {
    for (const link of await ctx.writer.list("IssueLabel", { labelId: current.id })) {
      await ctx.writer.delete("IssueLabel", link.id);
    }
  },
};

export const issueLabel: Rule<"IssueLabel"> = {
  async insert(ctx, value) {
    const input = parse(issueLabelRow, value);
    if (input.id !== pairId(input.issueId, input.labelId)) fail("invalid", "An issue label's id is issueId:labelId");
    await editable(ctx, input.issueId);
    await need(ctx, "Label", input.labelId);
    if (await ctx.writer.get("IssueLabel", input.id)) fail("conflict", "The label is already applied");
    await logActivity(ctx, input.issueId, "label", null, input.labelId);
    return input;
  },
  async delete(ctx, current) {
    await editable(ctx, current.issueId);
    await logActivity(ctx, current.issueId, "label", current.labelId, null);
  },
};

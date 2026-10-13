import { issueRelationId, issueRelationRow, type Row, relationSide } from "@entwine/shared";
import { logActivity } from "./shared/activity";
import { editable } from "./shared/guards";
import { fail, parse, type Rule, type WriteContext } from "./shared/rule";

/** Logs a relation on both issues, each from its own side (`blocks` on one, `blocked_by` on the other). */
async function logRelation(ctx: WriteContext, relation: Row<"IssueRelation">, added: boolean): Promise<void> {
  for (const issueId of [relation.issueId, relation.relatedId]) {
    const { side, otherId } = relationSide(relation, issueId);
    const value = `${side}:${otherId}`;
    await logActivity(ctx, issueId, "relation", added ? null : value, added ? value : null);
  }
}

/** Logs a relation's removal, except on the issue being deleted, whose activity goes with it. */
export async function deleteRelation(ctx: WriteContext, relation: Row<"IssueRelation">, deletedIssueId: string) {
  const otherId = relation.issueId === deletedIssueId ? relation.relatedId : relation.issueId;
  const { side } = relationSide(relation, otherId);
  await logActivity(ctx, otherId, "relation", `${side}:${deletedIssueId}`, null);
}

export const issueRelation: Rule<"IssueRelation"> = {
  async insert(ctx, value) {
    const input = parse(issueRelationRow.omit({ createdAt: true }), value);
    if (input.issueId === input.relatedId) fail("invalid", "An issue cannot relate to itself");
    if (input.id !== issueRelationId(input.issueId, input.relatedId))
      fail("invalid", "A relation's id is its two issue ids, sorted and joined with ':'");
    await editable(ctx, input.issueId);
    await editable(ctx, input.relatedId);
    if (await ctx.writer.get("IssueRelation", input.id)) fail("conflict", "These issues are already related");
    return { ...input, createdAt: ctx.now };
  },
  async afterInsert(ctx, row) {
    await logRelation(ctx, row, true);
  },
  async delete(ctx, current) {
    await editable(ctx, current.issueId);
    await editable(ctx, current.relatedId);
    await logRelation(ctx, current, false);
  },
};

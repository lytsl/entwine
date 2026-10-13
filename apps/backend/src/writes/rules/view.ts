import { isIssueQuery, type Row, viewRow } from "@entwine/shared";
import { need } from "./shared/guards";
import { changed, fail, isAdmin, parse, type Rule, type WriteContext } from "./shared/rule";

const viewFields = viewRow.pick({ id: true, name: true, projectId: true }).extend({
  query: viewRow.shape.query.refine(isIssueQuery, "The view's query is not a valid issue query"),
});

function canEditView(ctx: WriteContext, current: Row<"View">): void {
  if (current.creatorId !== ctx.userId && !isAdmin(ctx))
    fail("forbidden", "Only its creator or an admin can change a view");
}

export const view: Rule<"View"> = {
  async insert(ctx, value) {
    const input = parse(viewFields, value);
    if (input.projectId) await need(ctx, "Project", input.projectId);
    return { ...input, creatorId: ctx.userId, createdAt: ctx.now, updatedAt: ctx.now };
  },
  async update(ctx, current, value) {
    canEditView(ctx, current);
    const patch = changed(current, parse(viewFields.pick({ name: true, query: true }).partial(), value));
    return Object.keys(patch).length ? { ...patch, updatedAt: ctx.now } : patch;
  },
  async delete(ctx, current) {
    canEditView(ctx, current);
  },
};

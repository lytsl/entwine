import { cycleRow } from "@entwine/shared";
import { logActivity } from "./shared/activity";
import { activeProject } from "./shared/guards";
import { canDeletePlan, checkPlanDates } from "./shared/plan";
import { changed, parse, type Rule } from "./shared/rule";

const cycleFields = cycleRow.pick({ name: true, description: true, startDate: true, endDate: true });

export const cycle: Rule<"Cycle"> = {
  async insert(ctx, value) {
    const input = parse(
      cycleFields.partial({ description: true }).extend({
        id: cycleRow.shape.id,
        projectId: cycleRow.shape.projectId,
      }),
      value,
    );
    await activeProject(ctx, input.projectId);
    checkPlanDates(input.startDate, input.endDate, "end date");
    return {
      description: "",
      ...input,
      creatorId: ctx.userId,
      rolledIssues: 0,
      rolledPoints: 0,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
  },
  async update(ctx, current, value) {
    const patch = changed(current, parse(cycleFields.partial(), value));
    if (!Object.keys(patch).length) return patch;
    await activeProject(ctx, current.projectId);
    const next = { ...current, ...patch };
    checkPlanDates(next.startDate, next.endDate, "end date");
    return { ...patch, updatedAt: ctx.now };
  },
  /** Its issues stay, out of any cycle, and say so in their activity. */
  async delete(ctx, current) {
    canDeletePlan(ctx, current, "cycle");
    for (const issue of await ctx.writer.list("Issue", { cycleId: current.id })) {
      await ctx.writer.update("Issue", issue.id, { cycleId: null, updatedAt: ctx.now });
      await logActivity(ctx, issue.id, "cycleId", current.id, null);
    }
  },
};

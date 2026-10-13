import { issueModuleRow, moduleMemberRow, moduleRow, pairId } from "@entwine/shared";
import { logActivity } from "./shared/activity";
import { activeProject, editable, need } from "./shared/guards";
import { canDeletePlan, checkPlanDates } from "./shared/plan";
import { changed, fail, parse, type Rule, type WriteContext } from "./shared/rule";

const moduleFields = moduleRow.pick({
  name: true,
  description: true,
  status: true,
  startDate: true,
  targetDate: true,
  leadId: true,
});

/** Someone who left stays named where they were, as an assignee does, but is not put anywhere new. */
async function currentMember(ctx: WriteContext, memberId: string, what: string): Promise<void> {
  const member = await ctx.writer.get("Member", memberId);
  if (!member || member.removed) fail("invalid", `The ${what} is not a member of this workspace`);
}

export async function deleteModuleMembers(ctx: WriteContext, moduleId: string): Promise<void> {
  for (const row of await ctx.writer.list("ModuleMember", { moduleId }))
    await ctx.writer.delete("ModuleMember", row.id);
}

export const projectModule: Rule<"Module"> = {
  async insert(ctx, value) {
    const input = parse(
      moduleFields
        .partial({ description: true, status: true, startDate: true, targetDate: true, leadId: true })
        .extend({ id: moduleRow.shape.id, projectId: moduleRow.shape.projectId }),
      value,
    );
    await activeProject(ctx, input.projectId);
    checkPlanDates(input.startDate ?? null, input.targetDate ?? null, "target date");
    if (input.leadId) await currentMember(ctx, input.leadId, "lead");
    return {
      description: "",
      status: "backlog",
      startDate: null,
      targetDate: null,
      leadId: null,
      ...input,
      creatorId: ctx.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
  },
  async update(ctx, current, value) {
    const patch = changed(current, parse(moduleFields.partial(), value));
    if (!Object.keys(patch).length) return patch;
    await activeProject(ctx, current.projectId);
    const next = { ...current, ...patch };
    checkPlanDates(next.startDate, next.targetDate, "target date");
    if (patch.leadId) await currentMember(ctx, patch.leadId, "lead");
    return { ...patch, updatedAt: ctx.now };
  },
  /** Its issues stay, in their other modules, and say so in their activity. */
  async delete(ctx, current) {
    canDeletePlan(ctx, current, "module");
    for (const link of await ctx.writer.list("IssueModule", { moduleId: current.id })) {
      await ctx.writer.delete("IssueModule", link.id);
      await logActivity(ctx, link.issueId, "module", current.id, null);
    }
    await deleteModuleMembers(ctx, current.id);
  },
};

export const moduleMember: Rule<"ModuleMember"> = {
  async insert(ctx, value) {
    const input = parse(moduleMemberRow, value);
    if (input.id !== pairId(input.moduleId, input.memberId))
      fail("invalid", "A module member's id is moduleId:memberId");
    const module = await need(ctx, "Module", input.moduleId);
    await activeProject(ctx, module.projectId);
    await currentMember(ctx, input.memberId, "module member");
    return input;
  },
  async delete(ctx, current) {
    const module = await need(ctx, "Module", current.moduleId);
    await activeProject(ctx, module.projectId);
  },
};

export const issueModule: Rule<"IssueModule"> = {
  async insert(ctx, value) {
    const input = parse(issueModuleRow, value);
    if (input.id !== pairId(input.issueId, input.moduleId)) fail("invalid", "An issue module's id is issueId:moduleId");
    const issue = await editable(ctx, input.issueId);
    const module = await need(ctx, "Module", input.moduleId);
    if (module.projectId !== issue.projectId) fail("invalid", "The module must be a module of the issue's project");
    await activeProject(ctx, issue.projectId);
    if (await ctx.writer.get("IssueModule", input.id)) fail("conflict", "The issue is already in this module");
    await logActivity(ctx, input.issueId, "module", null, input.moduleId);
    return input;
  },
  async delete(ctx, current) {
    const issue = await editable(ctx, current.issueId);
    await activeProject(ctx, issue.projectId);
    await logActivity(ctx, current.issueId, "module", current.moduleId, null);
  },
};

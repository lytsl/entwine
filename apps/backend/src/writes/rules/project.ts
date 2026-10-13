import { cycleScheduleInput, NO_CYCLE_SCHEDULE, pairId, projectInput, projectRow } from "@entwine/shared";
import { deleteIssueRows } from "./issue";
import { deleteModuleMembers } from "./module";
import { changed, fail, isAdmin, parse, type Rule, type WriteContext } from "./shared/rule";

const projectPatch = projectInput
  .extend({ defaultStateId: projectRow.shape.defaultStateId, archivedAt: projectRow.shape.archivedAt })
  .extend(cycleScheduleInput.shape)
  .partial();

async function uniqueIdentifier(ctx: WriteContext, identifier: string, id: string): Promise<void> {
  const [other] = await ctx.writer.list("Project", { identifier });
  if (other && other.id !== id) fail("conflict", `Identifier ${identifier} is taken`);
}

export const project: Rule<"Project"> = {
  async restore(ctx, row) {
    await uniqueIdentifier(ctx, row.identifier, row.id);
    // Its schedule was not carried out while it was gone.
    if (row.cycleWeeks !== null) ctx.replan?.();
  },
  async insert(ctx, value) {
    const input = parse(projectInput.extend({ id: projectRow.shape.id }), value);
    await uniqueIdentifier(ctx, input.identifier, input.id);
    return {
      ...input,
      lastIssueNumber: 0,
      defaultStateId: pairId(input.id, "backlog"),
      archivedAt: null,
      ...NO_CYCLE_SCHEDULE,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
  },
  async update(ctx, current, value) {
    const input = parse(projectPatch, value);
    // Clients say "archived" with any number; the time is the server's, and re-archiving keeps the first one.
    if (input.archivedAt != null) input.archivedAt = current.archivedAt ?? ctx.now;
    const patch = changed(current, input);
    if (patch.identifier) await uniqueIdentifier(ctx, patch.identifier, current.id);
    if (patch.defaultStateId !== undefined) {
      const state = await ctx.writer.get("State", patch.defaultStateId);
      if (state?.projectId !== current.id) fail("invalid", "The default state must be a state of the project");
    }
    // The cycles a schedule asks for are the server's own write, made once this one has committed. A project that
    // leaves the archive is owed what its schedule skipped meanwhile.
    if (Object.keys(patch).some((field) => field in cycleScheduleInput.shape) || patch.archivedAt === null)
      ctx.replan?.();
    return Object.keys(patch).length ? { ...patch, updatedAt: ctx.now } : patch;
  },
  /** SQLite's cascades would bypass the change log, so every dependent row is deleted here. */
  async delete(ctx, current) {
    if (!isAdmin(ctx)) fail("forbidden", "Only an owner or admin can delete a project");
    for (const issue of await ctx.writer.list("Issue", { projectId: current.id })) {
      await deleteIssueRows(ctx, issue.id);
      await ctx.writer.delete("Issue", issue.id);
    }
    for (const module of await ctx.writer.list("Module", { projectId: current.id }))
      await deleteModuleMembers(ctx, module.id);
    // After the issues, whose deletion took the module memberships with it.
    for (const model of ["State", "View", "Cycle", "Module"] as const) {
      for (const row of await ctx.writer.list(model, { projectId: current.id })) await ctx.writer.delete(model, row.id);
    }
  },
};

import { pairId, stateRow } from "@entwine/shared";
import { need } from "./shared/guards";
import { changed, fail, parse, type Rule, type WriteContext } from "./shared/rule";

const stateFields = stateRow.pick({ name: true, color: true, group: true, position: true });

async function uniqueStateName(ctx: WriteContext, projectId: string, name: string, id: string): Promise<void> {
  const key = name.trim().toLowerCase();
  const states = await ctx.writer.list("State", { projectId });
  if (states.some((s) => s.id !== id && s.name.trim().toLowerCase() === key))
    fail("conflict", `State ${name.trim()} already exists in this project`);
}

export const state: Rule<"State"> = {
  restore: (ctx, row) => uniqueStateName(ctx, row.projectId, row.name, row.id),
  async insert(ctx, value) {
    const input = parse(stateRow, value);
    await need(ctx, "Project", input.projectId);
    // Derived ids are reserved for default states, which clients reference before the server confirms them.
    if (input.id.includes(":") && input.id !== pairId(input.projectId, input.group))
      fail("invalid", "A state's id is a UUID, or projectId:group for a default state");
    await uniqueStateName(ctx, input.projectId, input.name, input.id);
    return input;
  },
  async update(ctx, current, value) {
    const patch = changed(current, parse(stateFields.partial(), value));
    if (patch.name) await uniqueStateName(ctx, current.projectId, patch.name, current.id);
    return patch;
  },
  async delete(ctx, current) {
    const project = await ctx.writer.get("Project", current.projectId);
    if (project?.defaultStateId === current.id) fail("invalid", "The default state cannot be deleted");
    if ((await ctx.writer.list("Issue", { stateId: current.id })).length)
      fail("conflict", "Issues are in this state; move them to another state first");
  },
};

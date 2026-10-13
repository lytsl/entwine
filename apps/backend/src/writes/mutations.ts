import type { ModelName } from "@entwine/shared";
import type { Mutation } from "@entwine/sync-engine/protocol";
import { rules } from "./rules";
import { need } from "./rules/shared/guards";
import { fail, type Rule, type WriteContext } from "./rules/shared/rule";

/** Throws a `WriteError` and writes nothing if any mutation is refused. */
export async function applyMutations(ctx: WriteContext, mutations: readonly Mutation[]): Promise<void> {
  for (const { type, key, value, ...m } of mutations) {
    const model = m.model as ModelName;
    const rule = rules[model] as Rule<ModelName> | undefined;
    const handler = rule?.[type];
    if (!handler) fail("forbidden", `Clients cannot ${type} ${model}`);
    if (type === "insert") {
      if (value.id !== key) fail("invalid", "The key must be the row's id");
      if (await ctx.writer.get(model, key)) fail("conflict", `${model} ${key} already exists`);
      const row = await rule!.insert!(ctx, value);
      await ctx.writer.insert(model, row);
      await rule!.afterInsert?.(ctx, row);
    } else if (type === "update") {
      const current = await need(ctx, model, key);
      const patch = await rule!.update!(ctx, current, value);
      if (Object.keys(patch).length) await ctx.writer.update(model, key, patch);
    } else {
      const current = await need(ctx, model, key);
      await rule!.delete!(ctx, current);
      await ctx.writer.delete(model, key);
    }
  }
}

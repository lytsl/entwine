import type { WriteContext } from "./rule";

export async function logActivity(
  ctx: WriteContext,
  issueId: string,
  field: string,
  oldValue: string | null = null,
  newValue: string | null = null,
): Promise<void> {
  await ctx.writer.insert("Activity", {
    id: crypto.randomUUID(),
    issueId,
    actorId: ctx.userId,
    field,
    oldValue,
    newValue,
    createdAt: ctx.now,
  });
}

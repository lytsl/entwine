import { fail, isAdmin, type WriteContext } from "./rule";

/**
 * Plans are edited by any member, and deleted by their creator or an owner or admin, even in an archived project. A
 * scheduled cycle has no creator.
 */
export function canDeletePlan(ctx: WriteContext, current: { creatorId: string | null }, kind: string): void {
  if (current.creatorId !== ctx.userId && !isAdmin(ctx))
    fail("forbidden", `Only its creator or an admin can delete a ${kind}`);
}

export function checkPlanDates(start: string | null, end: string | null, endName: string): void {
  if (start && end && start > end) fail("invalid", `The start date is after the ${endName}`);
}

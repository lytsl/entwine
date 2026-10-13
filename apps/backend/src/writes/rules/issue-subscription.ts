import { issueSubscriptionRow, pairId } from "@entwine/shared";
import { need } from "./shared/guards";
import { fail, parse, type Rule } from "./shared/rule";

/**
 * A member subscribes and unsubscribes themselves, on an archived issue too. The rules that subscribe a member for
 * what happened (`tell`) write the row themselves.
 */
export const issueSubscription: Rule<"IssueSubscription"> = {
  async insert(ctx, value) {
    const input = parse(issueSubscriptionRow.omit({ createdAt: true }), value);
    if (input.memberId !== ctx.userId) fail("forbidden", "Members subscribe themselves");
    if (input.id !== pairId(input.issueId, input.memberId)) fail("invalid", "A subscription's id is issueId:memberId");
    await need(ctx, "Issue", input.issueId);
    return { ...input, createdAt: ctx.now };
  },
  async delete(ctx, current) {
    if (current.memberId !== ctx.userId) fail("forbidden", "Members unsubscribe themselves");
  },
};

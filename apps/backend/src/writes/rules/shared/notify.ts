import { mentionedIds, NOTIFICATION_LIMIT, type NotificationKind, pairId } from "@entwine/shared";
import type { WriteContext } from "./rule";

/** The members a text mentions that the text it replaces did not. */
export function newMentions(text: string, before = ""): string[] {
  const had = new Set(mentionedIds(before));
  return mentionedIds(text).filter((id) => !had.has(id));
}

export interface Told {
  /** The actor follows the issue from now on: they created it or commented on it. */
  actor?: boolean;
  /** The member the issue is now assigned to. */
  assigned?: string | null;
  /** Members a text newly mentions; ids that are no member's are passed over. */
  mentioned?: readonly string[];
  /** What the issue's subscribers are told of. */
  subscribers?: Extract<NotificationKind, "commented" | "state">;
}

/**
 * Subscribes and notifies for one edit of an issue, in its transaction. The actor, the assignee and the mentioned
 * follow the issue from now on; nobody else is subscribed by what someone does, so unsubscribing lasts. A member
 * gets one notification, of the most direct kind, never of their own edit, and not once they have left. A revert
 * tells nobody: it takes back what its transaction told.
 */
export async function tell(ctx: WriteContext, issueId: string, told: Told): Promise<void> {
  if (ctx.quiet) return;
  const kinds = new Map<string, NotificationKind>();
  if (told.subscribers)
    for (const { memberId } of await ctx.writer.list("IssueSubscription", { issueId }))
      kinds.set(memberId, told.subscribers);
  for (const memberId of told.mentioned ?? []) kinds.set(memberId, "mentioned");
  if (told.assigned) kinds.set(told.assigned, "assigned");

  const follows = new Set([...(told.actor ? [ctx.userId] : []), ...(told.mentioned ?? []), told.assigned]);
  for (const memberId of new Set([...follows, ...kinds.keys()])) {
    if (!memberId) continue;
    const member = await ctx.writer.get("Member", memberId);
    if (!member || member.removed) continue;
    const id = pairId(issueId, memberId);
    if (follows.has(memberId) && !(await ctx.writer.get("IssueSubscription", id)))
      await ctx.writer.insert("IssueSubscription", { id, issueId, memberId, createdAt: ctx.now });
    const kind = kinds.get(memberId);
    if (kind && memberId !== ctx.userId) await notify(ctx, memberId, issueId, kind);
  }
}

/** A member keeps their newest notifications: they load with the workspace, so the oldest make room. */
async function notify(ctx: WriteContext, memberId: string, issueId: string, kind: NotificationKind): Promise<void> {
  const row = {
    id: crypto.randomUUID(),
    memberId,
    issueId,
    actorId: ctx.userId,
    kind,
    readAt: null,
    createdAt: ctx.now,
  };
  await ctx.writer.insert("Notification", row);
  ctx.notified?.(row);
  const kept = await ctx.writer.list("Notification", { memberId });
  if (kept.length <= NOTIFICATION_LIMIT) return;
  kept.sort((a, b) => a.createdAt - b.createdAt);
  for (const old of kept.slice(0, kept.length - NOTIFICATION_LIMIT)) await ctx.writer.delete("Notification", old.id);
}

import { notificationRow } from "@entwine/shared";
import { changed, parse, type Rule } from "./shared/rule";

/**
 * Notifications are written by the rules that cause them (`tell`). The member one is for marks it read or unread,
 * and nothing else; that it is theirs is the engine's check, since the sync schema names `memberId` as its owner.
 */
export const notification: Rule<"Notification"> = {
  async update(ctx, current, value) {
    // Strict: a write that names any other field is refused, not applied in part.
    const input = parse(notificationRow.pick({ readAt: true }).partial().strict(), value);
    // Clients say "read" with any number; the time is the server's.
    if (input.readAt != null) input.readAt = current.readAt ?? ctx.now;
    return changed(current, input);
  },
};

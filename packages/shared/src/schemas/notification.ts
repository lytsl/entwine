import { z } from "zod";
import { NOTIFICATION_CHOICES, NOTIFICATION_KINDS, type NotificationChoice } from "../constants";
import { id, time } from "./fields";

/** An account's, for every workspace: whether notifications are mailed, and what is neither mailed nor pushed. */
export const notificationPreferences = z.object({
  emailNotifications: z.boolean(),
  mutedNotifications: z.array(z.enum(NOTIFICATION_CHOICES)),
});

export type NotificationPreferences = z.infer<typeof notificationPreferences>;

/** The fields entwine adds to an account, as Better Auth declares them on the server and infers them in the app. */
export const ACCOUNT_FIELDS = {
  emailNotifications: { type: "boolean", defaultValue: true, required: false, input: true },
  // Not "string[]": on SQLite that is a TEXT column, which Better Auth's schema check then takes for a mismatch.
  mutedNotifications: { type: "json", defaultValue: [] as NotificationChoice[], required: false, input: true },
} as const;

/** `memberId` is whom it is for, and the only member who reads it; `actorId` is who did what `kind` says. */
export const notificationRow = z.object({
  id,
  memberId: id,
  issueId: id,
  actorId: id,
  kind: z.enum(NOTIFICATION_KINDS),
  readAt: time.nullable(),
  createdAt: time,
});

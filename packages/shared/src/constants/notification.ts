/**
 * What a member is told of. One edit gives a member at most one notification about an issue, the first of these
 * that applies.
 */
export const NOTIFICATION_KINDS = ["assigned", "mentioned", "commented", "state"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * What a member chooses to have mailed and pushed: each kind, and `completed`, a state change to a completed state,
 * which reaches a member who turned `state` off.
 */
export const NOTIFICATION_CHOICES = [...NOTIFICATION_KINDS, "completed"] as const;
export type NotificationChoice = (typeof NOTIFICATION_CHOICES)[number];

/** What its actor did, after their name: "Bob mentioned you". */
export const NOTIFICATION_TEXT: Record<NotificationKind, string> = {
  assigned: "assigned this to you",
  mentioned: "mentioned you",
  commented: "commented",
  state: "changed the state",
};

/** The notifications a member keeps: the newest. They load with the workspace, so they are few. */
export const NOTIFICATION_LIMIT = 200;

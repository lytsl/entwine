import type { NotificationChoice } from "@entwine/shared";

/** The sidebar counts unread notifications up to here, then says "99+". */
export const UNREAD_SHOWN = 99;

/** In the order the settings list them; `completed` sits under `state`, which it narrows. */
export const NOTIFICATION_CHOICE_TEXT: Record<NotificationChoice, { label: string; description: string }> = {
  assigned: { label: "Assignments", description: "When an issue is assigned to you." },
  mentioned: { label: "Mentions", description: "When someone mentions you in a description or a comment." },
  commented: { label: "Comments", description: "When someone comments on an issue you follow." },
  state: { label: "State changes", description: "When an issue you follow moves to another state." },
  completed: {
    label: "Completions",
    description: "When an issue you follow is completed, even with state changes off.",
  },
};

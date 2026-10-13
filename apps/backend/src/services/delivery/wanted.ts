import type { NotificationChoice, NotificationKind } from "@entwine/shared";

/** Whether a member who turned `muted` off wants a notification mailed and pushed. */
export const wanted = (muted: readonly NotificationChoice[], kind: NotificationKind, completed: boolean): boolean =>
  !muted.includes(kind) || (kind === "state" && completed && !muted.includes("completed"));

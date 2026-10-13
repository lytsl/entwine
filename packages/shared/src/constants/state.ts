/** In workflow order. */
export const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;
export type StateGroup = (typeof STATE_GROUPS)[number];

/** Only finished work is put away. */
export const ARCHIVABLE_GROUPS: readonly string[] = ["completed", "cancelled"] satisfies StateGroup[];

/** One per group. */
export const DEFAULT_STATES: readonly { group: StateGroup; name: string; color: string }[] = [
  { group: "backlog", name: "Backlog", color: "#8a8f98" },
  { group: "unstarted", name: "Todo", color: "#b4b8bf" },
  { group: "started", name: "In Progress", color: "#f2c94c" },
  { group: "completed", name: "Done", color: "#4cb782" },
  { group: "cancelled", name: "Cancelled", color: "#6b6f76" },
];

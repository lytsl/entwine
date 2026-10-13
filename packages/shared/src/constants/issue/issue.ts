/** Most urgent first. */
export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

/** Points on one scale for the whole workspace. */
export const ESTIMATES = [1, 2, 3, 5, 8, 13] as const;

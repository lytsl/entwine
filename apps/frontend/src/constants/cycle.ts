import type { CyclePhase } from "@entwine/shared";

export const PHASE_LABELS: Record<CyclePhase, { label: string; color: string }> = {
  current: { label: "Current", color: "#f59e0b" },
  upcoming: { label: "Upcoming", color: "#3f76ff" },
  past: { label: "Past", color: "#8a8f98" },
};

/** By `Date`'s day number: 0 is Sunday. */
export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
/** The order a week is offered in: from Monday. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

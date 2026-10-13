/** The order a project lists its cycles in. */
export const CYCLE_PHASES = ["current", "upcoming", "past"] as const;
export type CyclePhase = (typeof CYCLE_PHASES)[number];

/** A project's cycle schedule: how long a cycle may be, and how many upcoming cycles are kept created. */
export const MAX_CYCLE_WEEKS = 8;
export const MAX_UPCOMING_CYCLES = 6;
/** What a project starts with: no schedule, and what its form offers first. */
export const NO_CYCLE_SCHEDULE = {
  cycleWeeks: null,
  cycleStartDay: 1,
  cycleUpcoming: 2,
  cycleRollover: 0,
  cycleTimezone: "UTC",
} as const;

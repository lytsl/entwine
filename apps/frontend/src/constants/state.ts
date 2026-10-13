import { DEFAULT_STATES, type StateGroup } from "@entwine/shared";

export const GROUP_LABELS: Record<StateGroup, string> = {
  backlog: "Backlog",
  unstarted: "Unstarted",
  started: "Started",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** A group's colour where no state gives one: its default state's. */
export const GROUP_COLORS = Object.fromEntries(DEFAULT_STATES.map((s) => [s.group, s.color])) as Record<
  StateGroup,
  string
>;

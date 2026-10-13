import { STATE_GROUPS, type StateGroup } from "../constants";

export interface Progress {
  /** Cancelled issues included. */
  groups: Record<StateGroup, number>;
  total: number;
  done: number;
  /** Every issue that is not cancelled. */
  planned: number;
  /** `done` out of `planned`, 0 to 100; 0 when nothing is planned. */
  percent: number;
}

/** Each issue counts once, as it is: sub-issues only when they are among `issues` themselves. */
export const progress = <T>(
  issues: readonly T[],
  groupOf: (issue: T) => StateGroup | undefined,
  /** What an issue weighs: 1 to count issues, its estimate (nothing without one) to count points. */
  weightOf: (issue: T) => number = () => 1,
): Progress => progressOfCounts(issues.map((issue) => [groupOf(issue), weightOf(issue)]));

/** `progress` of issues already counted, or their points summed, per workflow group. */
export function progressOfCounts(counts: Iterable<readonly [StateGroup | undefined, number]>): Progress {
  const groups = Object.fromEntries(STATE_GROUPS.map((g) => [g, 0])) as Record<StateGroup, number>;
  let total = 0;
  for (const [group, count] of counts) {
    total += count;
    if (group) groups[group] += count;
  }
  const planned = total - groups.cancelled;
  const done = groups.completed;
  return { groups, total, done, planned, percent: planned ? (done / planned) * 100 : 0 };
}

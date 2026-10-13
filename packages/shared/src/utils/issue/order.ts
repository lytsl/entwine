import { type OrderBy, PRIORITIES, type Priority } from "../../constants";
import type { Row } from "../../schemas";

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p, i])) as Record<Priority, number>;
const byPriority = (a: Row<"Issue">, b: Row<"Issue">) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

// No two issues compare equal: an issue has one place in an order, which `patchSorted` finds by bisection.
const newest = (a: Row<"Issue">, b: Row<"Issue">) =>
  b.createdAt - a.createdAt || b.number - a.number || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const ORDERS: Record<OrderBy, (a: Row<"Issue">, b: Row<"Issue">) => number> = {
  priority: (a, b) => byPriority(a, b) || newest(a, b),
  created: newest,
  updated: (a, b) => b.updatedAt - a.updatedAt || newest(a, b),
  due: (a, b) => (a.dueDate ?? "￿").localeCompare(b.dueDate ?? "￿") || byPriority(a, b) || newest(a, b),
};

/** Negative when `a` comes before `b`; never 0 for two issues. */
export const compareIssues = (order: OrderBy) => ORDERS[order];

export const sortIssues = (issues: readonly Row<"Issue">[], order: OrderBy): Row<"Issue">[] =>
  [...issues].sort(ORDERS[order]);

/** Takes each row of `out` out and puts each row of `into` in at its place, in place of sorting again. */
export function patchSorted(
  sorted: readonly Row<"Issue">[],
  order: OrderBy,
  out: readonly Row<"Issue">[],
  into: readonly Row<"Issue">[],
): Row<"Issue">[] {
  const compare = ORDERS[order];
  const next = [...sorted];
  const place = (issue: Row<"Issue">) => {
    let low = 0;
    let high = next.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compare(next[middle] as Row<"Issue">, issue) < 0) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  for (const issue of out) {
    const at = place(issue);
    if (next[at]?.id === issue.id) next.splice(at, 1);
  }
  for (const issue of into) next.splice(place(issue), 0, issue);
  return next;
}

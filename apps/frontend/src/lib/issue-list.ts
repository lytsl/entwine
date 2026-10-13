import { type Store, unarchived } from "../store";
import type { Group } from "../types/issue-view";
import { type Issue } from "../types/rows";
import type { IssueScope } from "../types/shell";
import { canQuickAdd } from "./issue-groups";

/** Sub-issues nest this deep before a row stops offering to expand. */
const MAX_DEPTH = 3;

/** `header` is the index of the item's group header, or -1 without grouping. */
export type Item = { key: string; group: Group; header: number } & (
  | { kind: "header"; open: boolean }
  | { kind: "issue"; issue: Issue; depth: number; expandable: boolean; expanded: boolean }
  | { kind: "quick-add"; seed: NonNullable<Group["seed"]> }
);

export function flatten(
  groups: Group[],
  grouped: boolean,
  collapsed: ReadonlySet<string>,
  expanded: ReadonlySet<string>,
  store: Store,
  scope?: IssueScope,
): Item[] {
  const items: Item[] = [];
  for (const group of groups) {
    const open = !collapsed.has(group.key);
    const header = grouped ? items.length : -1;
    if (grouped) items.push({ kind: "header", key: `header:${group.key}`, group, header, open });
    if (!open) continue;
    const add = (issue: Issue, depth: number, key: string) => {
      // Membership never passes from a parent to its sub-issues, so a scoped view expands only to those in scope.
      let children = depth < MAX_DEPTH ? store.issues.childrenOf(issue.id) : [];
      if (children.length) children = children.filter((child) => unarchived(child) && (!scope || scope.has(child)));
      const isExpanded = children.length > 0 && expanded.has(issue.id);
      items.push({
        kind: "issue",
        key,
        group,
        header,
        issue,
        depth,
        expandable: children.length > 0,
        expanded: isExpanded,
      });
      // An issue can be on screen twice, as itself and under its parent: keys are paths.
      if (isExpanded) for (const child of children) add(child, depth + 1, `${key}/${child.id}`);
    };
    for (const issue of group.issues) add(issue, 0, `${group.key}/${issue.id}`);
    if (group.seed && canQuickAdd(group.seed, store))
      items.push({ kind: "quick-add", key: `quick-add:${group.key}`, group, header, seed: group.seed });
  }
  return items;
}

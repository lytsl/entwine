import { progress, type StateGroup } from "@entwine/shared";
import type { Store } from "../store";
import type { Issue } from "../types/rows";

/** Completed out of the issues that are not cancelled. */
export const progressOf = (issues: readonly Issue[], store: Store) =>
  progress(issues, (issue) => store.states.get(issue.stateId)?.group);

export function ancestorsOf(issue: Issue, store: Store): Set<string> {
  const ids = new Set<string>();
  for (let id = issue.parentId; id && !ids.has(id); id = store.issues.get(id)?.parentId ?? null) ids.add(id);
  return ids;
}

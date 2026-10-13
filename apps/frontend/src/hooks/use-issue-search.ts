import { useMemo, useState } from "react";
import { searchIssues } from "../lib/search";
import type { Store } from "../store";
import type { Issue } from "../types/rows";

/** Issues a search lists at once. */
const FOUND = 100;

/**
 * Lists the first issues until something is typed, then the best matches by key and title, never every issue.
 */
export function useIssueSearch(store: Store, issues: readonly Issue[]) {
  const [search, setSearch] = useState("");
  const found = useMemo(
    () =>
      search.trim()
        ? searchIssues(search, issues, (issue) => ({ key: store.issues.key(issue), title: issue.title }), FOUND)
        : issues.slice(0, FOUND),
    [search, issues, store],
  );
  return { search, setSearch, found };
}

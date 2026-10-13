import { useSyncStatus } from "@entwine/db-collection/react";
import { compareIssues, type IssueQuery, issuePageQuery } from "@entwine/shared";
import { useEffect, useMemo } from "react";
import { questionKey, type Scope, type Store } from "../store";
import type { Issue } from "../types/rows";
import { useToday } from "./use-today";

interface IssuePageView {
  issues: Issue[];
  /** How many issues the view has, loaded or not. */
  total: number;
  /** Absent when every issue is loaded. */
  more?(): void;
  loading: boolean;
  error?: Error;
}

/**
 * The issues a view shows. A view of one project, member, cycle or module shows what the tab holds. A view across
 * projects (`paged`) shows the part the server answered, up to the last issue loaded. Offline before an answer, it
 * shows what the device holds.
 */
export function useIssuePage(store: Store, scope: Scope, query: IssueQuery, paged: boolean): IssuePageView {
  const today = useToday();
  const offline = useSyncStatus() === "offline";
  const { pages } = store.issues;
  const key = paged ? questionKey(query, today) : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key says what is asked; the store is new at every edit.
  useEffect(() => {
    if (key === null) return;
    const unwatch = pages.watch(key, issuePageQuery(query, today, store.projects.sorted));
    const unlisten = store.issues.listen(() => pages.settle());
    return () => {
      unlisten();
      unwatch();
    };
  }, [pages, key]);

  const page = key === null ? undefined : pages.get(key);
  const answered = page !== undefined && (page.total > 0 || !page.loading) && !page.error;
  const held = store.issues.list(paged && !answered && offline ? store.issues.scope({}) : scope, query);
  const edge = page?.edge;
  const issues = useMemo(() => {
    if (!edge) return held;
    const compare = compareIssues(query.order);
    let low = 0;
    let high = held.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compare(held[middle] as Issue, edge) <= 0) low = middle + 1;
      else high = middle;
    }
    return low === held.length ? held : held.slice(0, low);
  }, [held, edge, query.order]);

  if (!paged || !page) return { issues, total: issues.length, loading: paged };
  return {
    issues,
    total: edge ? Math.max(page.total, issues.length) : issues.length,
    more: edge ? () => pages.more(key as string, issues.length) : undefined,
    loading: page.loading,
    error: page.error,
  };
}

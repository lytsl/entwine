import { useWorkspace } from "@entwine/db-collection/react";
import { issueSearchQueries, type Row, SEARCH_RANKS, type SearchRank, searchRank } from "@entwine/shared";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useEffect, useMemo, useState } from "react";
import { excerpt, matches } from "../lib/search";
import { NEWEST, type Store, unarchived } from "../store";
import type { Issue } from "../types/rows";

/** Issues the server is asked for of each kind of match. */
const ASKED = 30;

interface FoundIssue {
  issue: Issue;
  rank: SearchRank;
  /** Where a description or a comment holds the words. */
  excerpt?: string;
}

/**
 * Issues of every active project, not only those of the pages opened so far, best match first and the most recently
 * updated first among equals. The server finds them by key, title, description and comments; the workspace takes
 * them in, and they are ranked here together with the issues the tab already holds.
 */
export function useFoundIssues(store: Store, search: string, limit: number): { found: FoundIssue[]; ready: boolean } {
  const ws = useWorkspace();
  const projects = store.projects.sorted;
  const [asked] = useDebouncedValue(search, { wait: 150 });
  const [answer, setAnswer] = useState<{ term: string; ids: string[]; comments: Row<"Comment">[] }>({
    term: "",
    ids: [],
    comments: [],
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked again when the text changes, not the projects.
  useEffect(() => {
    const queries = issueSearchQueries(asked, projects, ASKED);
    if (!queries.length) return;
    let current = true;
    const answered = (rows: Record<string, { id: string }[]> = {}) =>
      current &&
      setAnswer({
        term: asked,
        ids: (rows.Issue ?? []).map((issue) => issue.id),
        comments: (rows.Comment ?? []) as Row<"Comment">[],
      });
    ws.find(queries).then(
      ({ rows }) => answered(rows),
      () => answered(),
    );
    return () => {
      current = false;
    };
  }, [asked, ws]);

  const held = store.issues.list(store.issues.scope({}), { ...NEWEST, order: "updated" });
  const found = useMemo(() => {
    if (!search.trim()) return [];
    const comments = Map.groupBy(answer.comments, (comment) => comment.issueId);
    const active = (issue: Issue) => unarchived(issue) && store.projects.get(issue.projectId)?.archivedAt === null;
    const candidates = new Set([...answer.ids.flatMap((id) => store.issues.get(id) ?? []).filter(active), ...held]);
    const ranked: FoundIssue[] = [];
    for (const issue of candidates) {
      const bodies = (comments.get(issue.id) ?? []).map((comment) => comment.body);
      const rank = searchRank(search, { ...issue, key: store.issues.key(issue), comments: bodies });
      if (!rank) continue;
      const text =
        rank === "description"
          ? issue.description
          : rank === "comment"
            ? (bodies.find((body) => matches(search, [body])) ?? "")
            : "";
      ranked.push({ issue, rank, excerpt: text ? excerpt(text, search) : undefined });
    }
    const place = (rank: SearchRank) => SEARCH_RANKS.indexOf(rank);
    return ranked
      .sort((a, b) => place(a.rank) - place(b.rank) || b.issue.updatedAt - a.issue.updatedAt)
      .slice(0, limit);
  }, [search, answer, held, store, limit]);

  // Searching from the first key typed until the server has answered for the text as it stands now.
  return { found, ready: issueSearchQueries(search, projects, ASKED).length === 0 || answer.term === search };
}

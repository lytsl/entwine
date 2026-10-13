/**
 * The issues of each scope a page asks for, kept in order and patched by the index's changes: every page that lists
 * issues gets them here, so none goes through the issues itself.
 */

import {
  DEFAULT_QUERY,
  FILTER_KEYS,
  type IssueContext,
  type IssueQuery,
  issueFilter,
  localToday,
  patchSorted,
  sortIssues,
} from "@entwine/shared";
import type { Issue } from "../../types/rows";
import type { IssueIndex } from "./issue-index";

/** Which issues a page looks at, before its filters. Scopes with the same key ask the same. */
export interface Scope {
  key: string;
  has(issue: Issue): boolean;
}

/** Every issue of a scope, sub-issues included, newest first: what a picker lists. */
export const NEWEST: IssueQuery = { ...DEFAULT_QUERY, subIssues: true, order: "created" };

/** Lists kept at once, the ones asked last: a list of every issue is a reference per issue. */
const KEPT = 12;

/** What a scope's answer depends on. Layout, grouping and shown properties are not part of it. */
export const questionKey = (query: IssueQuery, today: string) =>
  JSON.stringify([today, query.q.trim().toLowerCase(), query.subIssues, query.order, FILTER_KEYS.map((k) => query[k])]);

export class IssueLists {
  readonly #kept = new Map<string, { version: number; shown: Issue[]; rows: Map<string, Issue> }>();

  /** `context` must hold for as long as the lists do: a change to what filtering reads of it starts them again. */
  constructor(
    private readonly index: IssueIndex,
    private readonly context: IssueContext,
  ) {}

  /**
   * The issues of `scope` that `query` lets through, in its order. An edit takes the issues it touched out and puts
   * them back in place; every issue is gone through only the first time a question is asked, and when the index
   * cannot say what was touched. The array is the same until it changes.
   */
  issues(scope: Scope, query: IssueQuery = NEWEST): Issue[] {
    const { index } = this;
    const today = localToday();
    // A page and a picker open on it may ask the same scope differently, so a list is kept per question.
    const key = `${scope.key} ${questionKey(query, today)}`;
    const last = this.#kept.get(key);
    if (last) {
      // The list asked last is dropped last.
      this.#kept.delete(key);
      this.#kept.set(key, last);
      if (last.version === index.version) return last.shown;
    }
    const passes = issueFilter(query, this.context, today);
    const touched = last ? index.touchedSince(last.version) : null;
    if (last && touched) {
      const out: Issue[] = [];
      const into: Issue[] = [];
      for (const id of touched) {
        const before = last.rows.get(id);
        const after = index.issues.get(id);
        if (before) out.push(before);
        if (after && scope.has(after) && passes(after)) {
          into.push(after);
          last.rows.set(id, after);
        } else last.rows.delete(id);
      }
      if (out.length || into.length) last.shown = patchSorted(last.shown, query.order, out, into);
      last.version = index.version;
      return last.shown;
    }
    const found: Issue[] = [];
    for (const issue of index.issues.values()) if (scope.has(issue) && passes(issue)) found.push(issue);
    const shown = sortIssues(found, query.order);
    this.#kept.set(key, {
      version: index.version,
      shown,
      rows: new Map(shown.map((issue) => [issue.id, issue])),
    });
    if (this.#kept.size > KEPT) this.#kept.delete(this.#kept.keys().next().value as string);
    return shown;
  }
}

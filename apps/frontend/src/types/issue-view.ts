import type { FilterKey, IssueQuery } from "@entwine/shared";
import type { ReactNode, RefObject } from "react";
import type { IssuePatch, Store } from "../store";
import type { Issue } from "./rows";
import type { IssueScope, NewIssueDefaults } from "./shell";

export interface LayoutProps {
  /** Filtered and ordered. */
  issues: Issue[];
  query: IssueQuery;
  store: Store;
  projectId?: string;
  /** The cycle or module the view is limited to, which expanded sub-issues stay within too. */
  scope?: IssueScope;
  collapsed: ReadonlySet<string>;
  onToggleGroup(key: string): void;
  onNewIssue(seed: NewIssueDefaults): void;
  peekId?: string;
  onPeek(issueId: string): void;
  /** The issue the keyboard is on, marked in the list, board and spreadsheet. */
  focusedId: string | null;
  /**
   * The ids of the issues the layout shows, in on-screen order, which the layout keeps up to date (`useShownOrder`):
   * most have no element, since only what is near the viewport renders. Calendar and timeline leave it empty, and
   * take no part in keyboard focus or selection.
   */
  order: RefObject<readonly string[]>;
}

export type QueryChange = (patch: Partial<IssueQuery>) => void;

/** A list group or board column. */
export interface Group {
  key: string;
  name: string;
  icon?: ReactNode;
  issues: Issue[];
  /** What dropping an issue on the group changes; absent when the group takes no drops. */
  patch?(issue: Issue): IssuePatch | null;
  /** What a new issue created in the group starts with; absent when the group has no project to create it in. */
  seed?: NewIssueDefaults & { projectId: string };
}

export interface Selection {
  selected: ReadonlySet<string>;
  /** Toggles an issue; with `range`, selects every issue shown from the last one picked to it. */
  pick(issueId: string, range: boolean): void;
}

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface FilterDef {
  key: FilterKey;
  title: string;
  options: FilterOption[];
}

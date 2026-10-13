/**
 * What the workspace shell offers its pages. It knows the issue view on screen so that "Open" after creating an issue
 * peeks at it instead of leaving the view, and a new issue lands in the cycle or module the view is limited to.
 */
import type { Layout } from "@entwine/shared";
import type { RefObject } from "react";
import type { NewIssue } from "../store";
import type { Issue } from "./rows";

/** What a new issue starts with: a project, a group's state, priority or assignee, a parent, a plan, a copy. */
export type NewIssueDefaults = Partial<NewIssue>;

/**
 * A cycle or module a view is limited to. It sits outside the view's filters, so clearing them cannot widen it, and
 * every way of creating an issue in the view starts with its `seed`.
 */
export interface IssueScope {
  has(issue: Issue): boolean;
  seed: NewIssueDefaults & { projectId: string };
}

/** The issue view on screen, for the palette's layout commands. */
export interface ViewControls {
  layout: Layout;
  setLayout(layout: Layout): void;
}

/** Who shows an issue; the issue in context is the page's, else the peek's, else the view's focused one. */
export type ContextSource = "page" | "peek" | "focus";

export type PalettePage = "root" | "state" | "priority" | "assignee" | "labels" | "estimate" | "cycle" | "modules";

export type CreateKind = "project" | "view" | "cycle" | "module";

export interface Shell {
  openNewIssue(defaults?: NewIssueDefaults): void;
  /** Set by the issue view on screen: opens an issue beside it. */
  peek: RefObject<((issueId: string) => void) | null>;
  /** Set by the issue view on screen while it is limited to a cycle or module. */
  scope: RefObject<IssueScope | null>;
  /** Set by the issue view on screen. */
  view: RefObject<ViewControls | null>;
  /** The issues shown by each source; read through `issueInContext`. */
  shown: Map<ContextSource, string>;
  /** Opens the palette, on the choices of a property of the issue in context when `page` is one. */
  openPalette(page?: PalettePage): void;
  openShortcuts(): void;
  /** Cycles and modules are made in `projectId`. */
  openCreate(kind: CreateKind, projectId?: string): void;
  confirmDelete(issueId: string, onDeleted?: () => void): void;
}

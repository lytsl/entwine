import type { Workspace } from "@entwine/db-collection/react";
import {
  ARCHIVABLE_GROUPS,
  type IssueQuery,
  issueKey,
  type Priority,
  pairId,
  progressOfCounts,
  type StateGroup,
} from "@entwine/shared";
import type { Issue, Label, Module, Project, State } from "../../types/rows";
import type { RowStore } from "../row-store";
import { IssueIndex } from "./issue-index";
import { IssueLists, type Scope } from "./issue-lists";
import { IssuePages } from "./issue-pages";
import { type ScopeOf, scopeOf } from "./scope";

export interface NewIssue {
  projectId: string;
  title: string;
  description?: string;
  stateId?: string;
  priority?: Priority;
  assigneeId?: string | null;
  parentId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  labelIds?: string[];
  cycleId?: string | null;
  moduleIds?: string[];
}

export type IssuePatch = Partial<
  Pick<
    Issue,
    | "title"
    | "description"
    | "stateId"
    | "priority"
    | "assigneeId"
    | "parentId"
    | "startDate"
    | "dueDate"
    | "estimate"
    | "cycleId"
  >
>;

const several = (ids: string | readonly string[]) => (typeof ids === "string" ? [ids] : ids);
// A label or module deleted meanwhile keeps its links until the server's deletions arrive.
const existing = (ids: string[], of: RowStore<{ id: string }>) => (ids.every(of.has) ? ids : ids.filter(of.has));

/**
 * A component reads the issues in four forms: one by id (`get`), a scope's kept list (`list`), a count (`progress`,
 * `points`, `stateCounts`, `labelUses`) or a capped search; nothing here hands out every issue.
 */
export class Issues {
  readonly #index: IssueIndex;
  #lists!: IssueLists;
  /** The parts of the workspace's issues that pages across projects hold. */
  readonly pages: IssuePages;

  constructor(
    private readonly ws: Workspace,
    private readonly of: {
      projects: RowStore<Project>;
      states: RowStore<State>;
      labels: RowStore<Label>;
      modules: RowStore<Module>;
    },
  ) {
    this.#index = new IssueIndex(ws.collections);
    this.pages = new IssuePages(ws, this.#index);
    this.restart();
  }

  listen = (listener: () => void) => this.#index.listen(listener);

  /** Drops the kept lists: a change to the rows filtering reads (states, projects, labels, modules) calls it. */
  restart(): void {
    const { states, projects } = this.of;
    this.#lists = new IssueLists(this.#index, {
      states: states.rows,
      projects: projects.rows,
      labelsOf: this.labelsOf,
      modulesOf: this.modulesOf,
    });
    this.pages.expire();
  }

  get = (id: string): Issue | undefined => this.#index.issues.get(id);

  /**
   * The issues a page looks at: a project's, or those of every project that is not archived; of those a member's, a
   * cycle's or a module's when one is named; and a project's archived issues in place of the others with `archived`.
   */
  scope = (of: ScopeOf): Scope =>
    scopeOf({ projects: this.of.projects.rows, inModule: this.inModule, whole: this.pages.whole }, of);

  /** Without a query, every issue of the scope, newest first. */
  list = (scope: Scope, query?: IssueQuery): Issue[] => this.#lists.issues(scope, query);

  /** Counts the changes to what a row shows of an issue: a row with the same `rev` and `epoch` is unchanged. */
  rev = (issueId: string): number => this.#index.rev(issueId);

  labelsOf = (issueId: string): string[] => existing(this.#index.labelsOf(issueId), this.of.labels);

  modulesOf = (issueId: string): string[] => existing(this.#index.modulesOf(issueId), this.of.modules);

  inModule = (moduleId: string, issueId: string): boolean =>
    this.of.modules.has(moduleId) && this.#index.inModule(moduleId, issueId);

  /** How many issues of a project, cycle or module are in each state, archived ones included. */
  stateCounts = (holderId: string) => this.#index.stateCounts(holderId);

  /** How far a project, cycle or module has come, over all its issues. */
  progress = (holderId: string) => this.#progressOf(this.#index.stateCounts(holderId));

  /** The same by estimate points: an issue without an estimate weighs nothing, and `planned` is 0 with none. */
  points = (holderId: string) => this.#progressOf(this.#index.statePoints(holderId));

  #progressOf = (byState: ReadonlyMap<string, number>) =>
    progressOfCounts([...byState].map(([stateId, count]) => [this.of.states.get(stateId)?.group, count]));

  archivedIn = (holderId: string): number => this.#index.archivedIn(holderId);

  labelUses = (labelId: string): number => this.#index.labelUses(labelId);

  linkCount = (issueId: string): number => this.#index.linkCount(issueId);

  /** Oldest first. */
  childrenOf = (issueId: string): Issue[] => {
    const children = this.#index.childrenOf(issueId);
    return children.length > 1 ? children.sort((a, b) => a.number - b.number) : children;
  };

  /** The issue and every issue below it: what cannot become its parent. */
  subtreeOf = (issueId: string): Set<string> => {
    const ids = new Set([issueId]);
    for (const id of ids) for (const child of this.#index.childrenOf(id)) ids.add(child.id);
    return ids;
  };

  /** Such as "ENG-12". */
  key = (issue: Issue): string => issueKey(this.of.projects.get(issue.projectId) ?? { identifier: "?" }, issue);

  /** Only finished work is put away. */
  canArchive = (issue: Issue): boolean => ARCHIVABLE_GROUPS.includes(this.of.states.get(issue.stateId)?.group ?? "");

  /** What "Make a copy" starts the new-issue dialog with: everything but the history, and "(copy)". */
  copyOf = (issue: Issue): NewIssue => ({
    projectId: issue.projectId,
    title: `${issue.title} (copy)`,
    description: issue.description,
    stateId: issue.stateId,
    priority: issue.priority,
    assigneeId: issue.assigneeId,
    parentId: issue.parentId,
    startDate: issue.startDate,
    dueDate: issue.dueDate,
    estimate: issue.estimate,
    labelIds: this.labelsOf(issue.id),
    cycleId: issue.cycleId,
    moduleIds: this.modulesOf(issue.id),
  });

  /** Predicts the number the server will give the issue. */
  create = (input: NewIssue): string => {
    const { ws } = this;
    const id = crypto.randomUUID();
    const now = Date.now();
    const project = ws.collections.Project.get(input.projectId);
    if (!project) throw new Error("Unknown project");
    this.pages.made(id);
    void ws.mutate(() => {
      ws.collections.Issue.insert({
        id,
        projectId: project.id,
        number: project.lastIssueNumber + 1,
        title: input.title,
        description: input.description ?? "",
        stateId: input.stateId ?? project.defaultStateId,
        priority: input.priority ?? "none",
        assigneeId: input.assigneeId ?? null,
        creatorId: ws.userId,
        parentId: input.parentId ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        estimate: input.estimate ?? null,
        cycleId: input.cycleId ?? null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      ws.collections.Project.update(project.id, (p) => {
        p.lastIssueNumber += 1;
      });
      for (const labelId of input.labelIds ?? []) {
        ws.collections.IssueLabel.insert({ id: pairId(id, labelId), issueId: id, labelId });
      }
      for (const moduleId of new Set(input.moduleIds)) {
        ws.collections.IssueModule.insert({ id: pairId(id, moduleId), issueId: id, moduleId });
      }
    });
    return id;
  };

  /** One issue or several, in one transaction: all change or none does, and one undo reverts them. */
  update = (ids: string | readonly string[], patch: IssuePatch) => {
    const now = Date.now();
    return this.ws.mutate(() => {
      for (const id of several(ids))
        this.ws.collections.Issue.update(id, (issue) => Object.assign(issue, patch, { updatedAt: now }));
    });
  };

  /** Unassigns the issue when it is already theirs. */
  assignToMe = (issue: Issue) =>
    this.update(issue.id, { assigneeId: issue.assigneeId === this.ws.userId ? null : this.ws.userId });

  /** One transaction; the server records when. */
  setArchived = (ids: readonly string[], archived: boolean) => {
    const now = Date.now();
    return this.ws.mutate(() => {
      for (const id of ids)
        this.ws.collections.Issue.update(id, (issue) =>
          Object.assign(issue, { archivedAt: archived ? now : null, updatedAt: now }),
        );
    });
  };

  delete = (ids: string | readonly string[]) =>
    this.ws.mutate(() => {
      for (const id of several(ids)) this.ws.collections.Issue.delete(id);
    });
}

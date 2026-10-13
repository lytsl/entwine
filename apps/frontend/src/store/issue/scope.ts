import type { Issue, Project } from "../../types/rows";
import type { Scope } from "./issue-lists";

/** Archived issues are only on the Archives page, not in views, searches or pickers. */
export const unarchived = (issue: Issue): boolean => issue.archivedAt === null;

/** See `Issues.scope`. */
export interface ScopeOf {
  projectId?: string | null;
  assigneeId?: string;
  cycleId?: string;
  moduleId?: string;
  archived?: boolean;
  /** Only the issues held with what a list shows of them (`IssuePages`): a page across projects, which holds a part. */
  paged?: boolean;
}

export function scopeOf(
  rows: {
    projects: ReadonlyMap<string, Project>;
    inModule(moduleId: string, issueId: string): boolean;
    whole(issueId: string): boolean;
  },
  of: ScopeOf,
): Scope {
  const { projectId, assigneeId, cycleId, moduleId, archived = false, paged = false } = of;
  const { projects, inModule, whole } = rows;
  return {
    key: [archived ? "archived" : "", paged ? "paged" : "", projectId, assigneeId, cycleId, moduleId].join(" "),
    has: (issue) =>
      unarchived(issue) !== archived &&
      (!paged || whole(issue.id)) &&
      (assigneeId === undefined || issue.assigneeId === assigneeId) &&
      (cycleId === undefined || issue.cycleId === cycleId) &&
      (moduleId === undefined || inModule(moduleId, issue.id)) &&
      (projectId ? issue.projectId === projectId : projects.get(issue.projectId)?.archivedAt === null),
  };
}

import type { DueFilter, StateGroup } from "../../constants";
import type { IssueQuery, Row } from "../../schemas";
import { addDays } from "../dates";
import { issueKey } from "./key";

/** What filtering reads beyond the issues. */
export interface IssueContext {
  states: ReadonlyMap<string, Pick<Row<"State">, "group">>;
  projects: ReadonlyMap<string, Pick<Row<"Project">, "identifier">>;
  labelsOf(issueId: string): string[];
  modulesOf(issueId: string): string[];
}

function matchesDue(filter: DueFilter, issue: Row<"Issue">, group: StateGroup | undefined, today: string): boolean {
  if (filter === "none") return issue.dueDate === null;
  if (issue.dueDate === null) return false;
  if (filter === "overdue") return issue.dueDate < today && group !== "completed" && group !== "cancelled";
  return issue.dueDate >= today && issue.dueDate <= addDays(today, 6);
}

/** What a view's filters let through; `issuePageQuery` asks the server for the same. `today` is an ISO date. */
export function issueFilter(query: IssueQuery, context: IssueContext, today: string): (issue: Row<"Issue">) => boolean {
  const text = query.q.trim().toLowerCase();
  const some = <T>(values: readonly T[], test: (value: T) => boolean) => !values.length || values.some(test);
  return (issue) => {
    const project = context.projects.get(issue.projectId);
    // A deleted project's issues linger until the server's deletions arrive.
    if (!project) return false;
    const group = context.states.get(issue.stateId)?.group;
    return (
      (query.subIssues || issue.parentId === null) &&
      some(query.groups, (g) => g === group) &&
      some(query.priorities, (p) => p === issue.priority) &&
      some(query.assignees, (a) => a === (issue.assigneeId ?? "none")) &&
      some(query.labels, (l) => context.labelsOf(issue.id).includes(l)) &&
      some(query.projects, (p) => p === issue.projectId) &&
      some(query.creators, (c) => c === issue.creatorId) &&
      some(query.due, (d) => matchesDue(d, issue, group, today)) &&
      some(query.cycles, (c) => c === (issue.cycleId ?? "none")) &&
      some(query.modules, (m) =>
        m === "none" ? !context.modulesOf(issue.id).length : context.modulesOf(issue.id).includes(m),
      ) &&
      (!text || `${issueKey(project, issue)} ${issue.title}`.toLowerCase().includes(text))
    );
  };
}

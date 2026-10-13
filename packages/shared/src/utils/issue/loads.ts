import type { Order, Query, Select, Where } from "@entwine/sync-engine/protocol";
import { type OrderBy, PRIORITIES } from "../../constants";
import type { IssueQuery, Row } from "../../schemas";
import { addDays } from "../dates";

/** `issueId` is the project of that issue. */
export type IssueScope = { projectId: string } | { issueId: string } | { assigneeId: string } | "all";

const ISSUE_ROWS = ["IssueLabel", "IssueModule", "IssueLink"] as const;

/**
 * Brings the issue at the other end of each relation, so a relation to another project can name it. A member's
 * issues come from any project, so they also bring their parents and sub-issues, which a project's already include.
 */
export function issueQueries(scope: IssueScope): Query[] {
  if (scope === "all") return ["Issue", "IssueRelation", ...ISSUE_ROWS].map((model) => ({ model }));
  const issues: Query = {
    model: "Issue",
    where:
      "assigneeId" in scope
        ? { assigneeId: scope.assigneeId }
        : {
            projectId:
              "projectId" in scope
                ? scope.projectId
                : { model: "Issue", select: "projectId", where: { id: scope.issueId } },
          },
  };
  const ids: Select = { ...issues, select: "id" };
  const family: Query[] =
    "assigneeId" in scope
      ? [
          { model: "Issue", where: { id: { ...issues, select: "parentId" } } },
          { model: "Issue", where: { parentId: ids } },
        ]
      : [];
  const from: Query = { model: "IssueRelation", where: { issueId: ids } };
  const to: Query = { model: "IssueRelation", where: { relatedId: ids } };
  return [
    issues,
    ...ISSUE_ROWS.map((model) => ({ model, where: { issueId: ids } })),
    from,
    to,
    { model: "Issue", where: { id: { ...from, select: "relatedId" } } },
    { model: "Issue", where: { id: { ...to, select: "issueId" } } },
    ...family,
  ];
}

/** The same order as `sortIssues`. */
const NEWEST: Order[] = [{ field: "createdAt", desc: true }, { field: "number", desc: true }, { field: "id" }];
const BY_PRIORITY: Order = { field: "priority", rank: [...PRIORITIES] };
const ORDERS: Record<OrderBy, Order[]> = {
  priority: [BY_PRIORITY, ...NEWEST],
  created: NEWEST,
  updated: [{ field: "updatedAt", desc: true }, ...NEWEST],
  due: [{ field: "dueDate" }, BY_PRIORITY, ...NEWEST],
};

type Keyed = readonly Pick<Row<"Project">, "id" | "identifier">[];

/** The issue a whole key names, such as "web-12". */
function keyed(text: string, projects: Keyed): Where[] {
  const [, identifier, number] = /^([a-z0-9]+)-(\d+)$/i.exec(text) ?? [];
  const project = identifier && projects.find((p) => p.identifier.toLowerCase() === identifier.toLowerCase());
  return project ? [{ projectId: project.id, number: Number(number) }] : [];
}

/**
 * What a page across projects asks the server for: the issues `issueFilter` lets through, of projects that are not
 * archived, in the order `sortIssues` gives them. The server finds a key only when it is typed whole. `today` is an
 * ISO date.
 */
export function issuePageQuery(query: IssueQuery, today: string, projects: Keyed): Query {
  const noneAs = (ids: readonly string[]) => ids.map((id) => (id === "none" ? null : id));
  const inGroups = (groups: readonly string[]): Select => ({
    model: "State",
    select: "id",
    where: { group: [...groups] },
  });
  const text = query.q.trim().slice(0, 100);
  const modules = query.modules.filter((id) => id !== "none");
  const due: Record<IssueQuery["due"][number], Where> = {
    none: { dueDate: null },
    week: { dueDate: { from: today, to: addDays(today, 6) } },
    overdue: { dueDate: { to: addDays(today, -1) }, stateId: inGroups(["backlog", "unstarted", "started"]) },
  };
  const any: Where[][] = [
    query.projects.length ? [{ projectId: query.projects }] : [],
    query.due.map((filter) => due[filter]),
    [
      ...(modules.length ? [{ id: { model: "IssueModule", select: "issueId", where: { moduleId: modules } } }] : []),
      ...(modules.length < query.modules.length ? [{ id: { not: { model: "IssueModule", select: "issueId" } } }] : []),
    ],
    text ? [{ title: { contains: [text] } }, ...keyed(text, projects)] : [],
  ];
  return {
    model: "Issue",
    where: {
      archivedAt: null,
      // Said as "of no archived project", the server reads the issues once; "of these projects" has it seek each's.
      projectId: { not: { model: "Project", select: "id", where: { archivedAt: { from: 0 } } } },
      ...(query.subIssues ? {} : { parentId: null }),
      ...(query.groups.length ? { stateId: inGroups(query.groups) } : {}),
      ...(query.priorities.length ? { priority: query.priorities } : {}),
      ...(query.assignees.length ? { assigneeId: noneAs(query.assignees) } : {}),
      ...(query.creators.length ? { creatorId: query.creators } : {}),
      ...(query.cycles.length ? { cycleId: noneAs(query.cycles) } : {}),
      ...(query.labels.length
        ? { id: { model: "IssueLabel", select: "issueId", where: { labelId: query.labels } } }
        : {}),
    },
    any: any.filter((alternatives) => alternatives.length),
    order: ORDERS[query.order],
  };
}

/** What a list shows of these issues besides their rows: their labels, modules, links, sub-issues and parents. */
export const issueRowQueries = (issueIds: readonly string[]): Query[] => [
  ...ISSUE_ROWS.map((model) => ({ model, where: { issueId: [...issueIds] } })),
  { model: "Issue", where: { parentId: [...issueIds] } },
  { model: "Issue", where: { id: { model: "Issue", select: "parentId", where: { id: [...issueIds] } } } },
];

/** What a search finds an issue by, best first. */
export const SEARCH_RANKS = ["key", "title", "description", "comment"] as const;
export type SearchRank = (typeof SEARCH_RANKS)[number];

/**
 * A search asks the server instead of holding every issue: for the issue whose key was typed whole, and the issues
 * whose title, description or one comment holds every word, the most recently updated of each. Nothing under two
 * characters. The comments come too, so that the one found can be shown.
 */
export function issueSearchQueries(term: string, projects: Keyed, limit: number): Query[] {
  const text = term.trim();
  if (text.length < 2) return [];
  const contains = text.split(/\s+/).slice(0, 10);
  const latest = { order: [{ field: "updatedAt", desc: true }], limit };
  const issues = (where: Where): Query => ({ model: "Issue", where: { archivedAt: null, ...where }, ...latest });
  const comments: Query = { model: "Comment", where: { body: { contains } }, ...latest };
  return [
    ...keyed(text, projects).map((where) => ({ model: "Issue", where })),
    issues({ title: { contains } }),
    issues({ description: { contains } }),
    comments,
    { model: "Issue", where: { archivedAt: null, id: { ...comments, select: "issueId" } } },
  ];
}

const holds = (text: string, words: readonly string[]) => words.every((word) => text.toLowerCase().includes(word));

/** What an issue was found by, or undefined when `term` finds it by nothing. */
export function searchRank(
  term: string,
  issue: Pick<Row<"Issue">, "title" | "description"> & { key: string; comments: readonly string[] },
): SearchRank | undefined {
  const text = term.trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  if (issue.key.toLowerCase() === text) return "key";
  if (holds(`${issue.key} ${issue.title}`, words)) return "title";
  if (holds(issue.description, words)) return "description";
  return issue.comments.some((body) => holds(body, words)) ? "comment" : undefined;
}

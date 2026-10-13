import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  addDays,
  DEFAULT_QUERY,
  type IssueQuery,
  issueFilter,
  issuePageQuery,
  issueSearchQueries,
  ORDER_BY,
  PRIORITIES,
  pairId,
  type Row,
  STATE_GROUPS,
  sortIssues,
} from "@entwine/shared";
import { allRows, createIssue, createProject, type Fixture, fixture, insert, update } from "../helpers/tenant";

const TODAY = "2026-03-10";
let f: Fixture;
let rows: Awaited<ReturnType<typeof allRows>>;

/** Sixty issues over two projects, a third archived, each differing from the next in what a view filters by. */
beforeAll(async () => {
  f = await fixture();
  const ok = async (mutations: Parameters<Fixture["send"]>[0]) => expect((await f.send(mutations)).status).toBe(200);
  await ok([...createProject("p1", "WEB"), ...createProject("p2", "API"), ...createProject("p3", "OLD")]);
  await ok([
    insert("Label", { id: "bug", name: "Bug", color: "#ff0000" }),
    insert("Label", { id: "ui", name: "UI", color: "#00ff00" }),
    insert("Module", { id: "m1", projectId: "p1", name: "Onboarding" }),
    insert("Cycle", { id: "c1", projectId: "p1", name: "Sprint", startDate: "2026-03-02", endDate: "2026-03-15" }),
  ]);
  for (let n = 0; n < 60; n++) {
    const id = `i${n}`;
    const projectId = n % 5 === 4 ? "p2" : n % 20 === 3 ? "p3" : "p1";
    await ok([
      createIssue(id, projectId, {
        title: n % 6 === 0 ? `Fix the footer ${n}` : `Task ${n}`,
        description: n % 9 === 0 ? "The footer overlaps the sidebar" : "",
        stateId: pairId(projectId, STATE_GROUPS[n % 5]),
        priority: PRIORITIES[n % 4],
        assigneeId: [null, "ada", "bob"][n % 3],
        dueDate: n % 4 === 0 ? null : addDays(TODAY, (n % 13) - 5),
        parentId: n % 10 === 7 ? `i${n - 5}` : null,
        cycleId: projectId === "p1" && n % 3 === 0 ? "c1" : null,
      }),
      ...(n % 4 === 1 ? [insert("IssueLabel", { id: pairId(id, "bug"), issueId: id, labelId: "bug" })] : []),
      ...(n % 8 === 2 ? [insert("IssueLabel", { id: pairId(id, "ui"), issueId: id, labelId: "ui" })] : []),
      ...(projectId === "p1" && n % 2 === 0
        ? [insert("IssueModule", { id: pairId(id, "m1"), issueId: id, moduleId: "m1" })]
        : []),
    ]);
  }
  await ok([insert("Comment", { id: "k1", issueId: "i1", body: "The FOOTER moved again" })]);
  await ok([update("Issue", "i8", { archivedAt: 1 }), update("Issue", "i18", { archivedAt: 1 })]);
  await ok([update("Project", "p3", { archivedAt: 1 })]);
  rows = await allRows(f.tenant);
});
afterAll(() => f.cleanup());

const QUERIES: Partial<IssueQuery>[] = [
  {},
  ...ORDER_BY.map((order) => ({ order })),
  { subIssues: false },
  { groups: ["started", "completed"] },
  { priorities: ["urgent", "none"] },
  { assignees: ["none", "bob"] },
  { labels: ["bug", "ui"] },
  { projects: ["p2", "p3"] },
  { creators: ["bob"] },
  { due: ["overdue"] },
  { due: ["week", "none"], order: "due" },
  { cycles: ["none"] },
  { cycles: ["c1", "none"], priorities: ["high"] },
  { modules: ["none"] },
  { modules: ["m1"], labels: ["bug"] },
  { modules: ["m1", "none"], groups: ["backlog"], due: ["overdue", "week"], order: "updated" },
  { q: "footer" },
  { q: "FIX the" },
  { q: "api-4" },
  { q: "web-12" },
];

test("the server answers a view across projects with the issues its filters let through, in its order", async () => {
  const context = {
    states: new Map(rows.State.map((state) => [state.id, state])),
    projects: new Map(rows.Project.map((project) => [project.id, project])),
    labelsOf: (id: string) => rows.IssueLabel.filter((link) => link.issueId === id).map((link) => link.labelId),
    modulesOf: (id: string) => rows.IssueModule.filter((link) => link.issueId === id).map((link) => link.moduleId),
  };
  const shown = (issue: Row<"Issue">) =>
    issue.archivedAt === null && context.projects.get(issue.projectId)?.archivedAt === null;
  let answered = 0;
  for (const patch of QUERIES) {
    const query = { ...DEFAULT_QUERY, ...patch };
    const passes = issueFilter(query, context, TODAY);
    const expected = sortIssues(
      rows.Issue.filter((issue) => shown(issue) && passes(issue)),
      query.order,
    ).map((i) => i.id);
    const { model, where, any, order } = issuePageQuery(query, TODAY, rows.Project);
    const answer = await f.tenant.load([
      { model, where, any, order, limit: 7, offset: 3 },
      { model, where, any, count: [] },
    ]);
    const label = JSON.stringify(patch);
    if (expected.length > 3) answered++;
    expect({ label, ids: (answer.rows.Issue ?? []).map((i) => i.id) }).toEqual({ label, ids: expected.slice(3, 10) });
    expect({ label, total: answer.counts?.[1][0].count }).toEqual({ label, total: expected.length });
  }
  // Most filters let more issues through than the part asked for skips, or they would prove nothing.
  expect(answered).toBeGreaterThanOrEqual(QUERIES.length - 4);
});

test("a search finds an issue by its key, title, description or a comment, and not an archived one", async () => {
  const found = async (term: string) => {
    const loaded = await f.tenant.load(issueSearchQueries(term, rows.Project, 30));
    return (loaded.rows.Issue ?? []).map((issue) => issue.id).sort();
  };
  expect(await found("web-2")).toEqual(["i1"]);
  expect(await found("moved again")).toEqual(["i1"]);
  expect(await found("sidebar overlaps")).toEqual(["i0", "i27", "i36", "i45", "i54", "i9"]);
  expect(await found("x")).toEqual([]);
  // i0 by title and description, i1 by its comment; i18 is archived.
  const footer = await found("footer");
  expect(footer).toContain("i0");
  expect(footer).toContain("i1");
  expect(footer).not.toContain("i18");
  const latest = await f.tenant.load(issueSearchQueries("task", rows.Project, 3));
  expect(latest.rows.Issue).toHaveLength(3);
  expect(latest.rows.Issue?.map((issue) => issue.id)).toEqual(["i59", "i58", "i57"]);
});

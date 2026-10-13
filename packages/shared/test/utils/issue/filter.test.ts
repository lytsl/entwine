import { describe, expect, test } from "bun:test";
import { DEFAULT_QUERY, type IssueContext, type IssueQuery, issueFilter, type Row } from "../../../src";

const issue = (id: string, patch: Partial<Row<"Issue">> = {}): Row<"Issue"> => ({
  id,
  projectId: "p1",
  number: Number(id.slice(1)),
  title: `Issue ${id}`,
  description: "",
  stateId: "todo",
  priority: "none",
  assigneeId: null,
  creatorId: "ada",
  parentId: null,
  startDate: null,
  dueDate: null,
  estimate: null,
  cycleId: null,
  archivedAt: null,
  createdAt: 0,
  updatedAt: 0,
  ...patch,
});

const context: IssueContext = {
  states: new Map([
    ["todo", { group: "unstarted" }],
    ["done", { group: "completed" }],
  ]),
  projects: new Map([
    ["p1", { identifier: "WEB" }],
    ["p2", { identifier: "API" }],
  ]),
  labelsOf: (issueId) => (issueId === "i2" ? ["bug"] : []),
  modulesOf: (issueId) => ({ i1: ["m1"], i2: ["m1", "m2"] })[issueId] ?? [],
};
const today = "2026-09-26";
const ids = (issues: Row<"Issue">[]) => issues.map((i) => i.id);
const filter = (issues: Row<"Issue">[], patch: Partial<IssueQuery>) =>
  ids(issues.filter(issueFilter({ ...DEFAULT_QUERY, ...patch }, context, today)));

describe("filtering", () => {
  test("values of one filter combine with OR, filters with AND", () => {
    const issues = [
      issue("i1", { priority: "high", assigneeId: "bob" }),
      issue("i2", { priority: "urgent", assigneeId: "bob" }),
      issue("i3", { priority: "high" }),
    ];
    expect(filter(issues, { priorities: ["high", "urgent"] })).toEqual(["i1", "i2", "i3"]);
    expect(filter(issues, { priorities: ["high", "urgent"], assignees: ["bob"] })).toEqual(["i1", "i2"]);
    expect(filter(issues, { assignees: ["none"] })).toEqual(["i3"]);
    expect(filter(issues, { labels: ["bug"] })).toEqual(["i2"]);
  });

  test("by project, creator and text in the key or title", () => {
    const issues = [issue("i1"), issue("i2", { projectId: "p2", creatorId: "cy" }), issue("i3", { projectId: "gone" })];
    expect(filter(issues, {})).toEqual(["i1", "i2"]);
    expect(filter(issues, { projects: ["p2"] })).toEqual(["i2"]);
    expect(filter(issues, { creators: ["ada"] })).toEqual(["i1"]);
    expect(filter(issues, { q: "api-2" })).toEqual(["i2"]);
  });

  test("by due date: overdue skips finished issues, the week is today and the next six days", () => {
    const issues = [
      issue("i1", { dueDate: "2026-09-25" }),
      issue("i2", { dueDate: "2026-09-25", stateId: "done" }),
      issue("i3", { dueDate: today }),
      issue("i4", { dueDate: "2026-10-02" }),
      issue("i5", { dueDate: "2026-10-03" }),
      issue("i6"),
    ];
    expect(filter(issues, { due: ["overdue"] })).toEqual(["i1"]);
    expect(filter(issues, { due: ["week"] })).toEqual(["i3", "i4"]);
    expect(filter(issues, { due: ["none", "overdue"] })).toEqual(["i1", "i6"]);
  });

  test("by cycle and module, with 'none' for issues in no cycle or no module", () => {
    const issues = [
      issue("i1", { cycleId: "c1" }),
      issue("i2", { cycleId: "c2" }),
      issue("i3", { cycleId: "c1" }),
      issue("i4"),
    ];
    expect(filter(issues, { cycles: ["c1", "c2"] })).toEqual(["i1", "i2", "i3"]);
    expect(filter(issues, { cycles: ["c1", "c2"], modules: ["m1"] })).toEqual(["i1", "i2"]);
    expect(filter(issues, { modules: ["m2", "none"] })).toEqual(["i2", "i3", "i4"]);
    expect(filter(issues, { cycles: ["none"], modules: ["none"] })).toEqual(["i4"]);
  });

  test("hiding sub-issues leaves out issues with a parent", () => {
    const issues = [issue("i1"), issue("i2", { parentId: "i1" })];
    expect(filter(issues, { subIssues: false })).toEqual(["i1"]);
  });
});

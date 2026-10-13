import { describe, expect, test } from "bun:test";
import {
  DEFAULT_QUERY,
  DISPLAY_PROPERTIES,
  isIssueQuery,
  patchSorted,
  type Row,
  readQuery,
  sortIssues,
} from "../../../src";

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

const ids = (issues: Row<"Issue">[]) => issues.map((i) => i.id);

describe("reading a query", () => {
  test("keeps each valid field of a URL and defaults the others", () => {
    const query = readQuery({ layout: "calendar", group: "sideways", priorities: ["high"], due: ["later"], extra: 1 });
    expect(query).toEqual({ ...DEFAULT_QUERY, layout: "calendar", priorities: ["high"] });
    expect(readQuery(null)).toEqual(DEFAULT_QUERY);
  });

  test("takes a view's own defaults for fields the URL leaves out", () => {
    const defaults = { ...DEFAULT_QUERY, groups: ["started" as const] };
    expect(readQuery({}, defaults).groups).toEqual(["started"]);
    expect(readQuery({ groups: [] }, defaults).groups).toEqual([]);
  });

  test("a stored query is JSON of a query without unknown keys", () => {
    expect(isIssueQuery(JSON.stringify(DEFAULT_QUERY))).toBe(true);
    expect(isIssueQuery("{}")).toBe(true);
    expect(isIssueQuery('{"layout":"gantt"}')).toBe(false);
    expect(isIssueQuery('{"owner":"me"}')).toBe(false);
    expect(isIssueQuery("{")).toBe(false);
  });

  test("rows show every property unless the query names fewer; a view stored before properties shows them all", () => {
    expect(DEFAULT_QUERY.properties).toEqual([...DISPLAY_PROPERTIES]);
    const stored = JSON.stringify({ layout: "board", priorities: ["high"] });
    expect(readQuery(JSON.parse(stored)).properties).toEqual([...DISPLAY_PROPERTIES]);
    expect(readQuery({ properties: ["key", "state"] }).properties).toEqual(["key", "state"]);
    expect(readQuery({ properties: ["key", "colour"] }).properties).toEqual([...DISPLAY_PROPERTIES]);
    expect(isIssueQuery('{"properties":["labels"]}')).toBe(true);
    expect(isIssueQuery('{"properties":["colour"]}')).toBe(false);
  });

  test("planning filters default empty, including in queries stored before them, and round-trip as JSON", () => {
    const stored = JSON.parse(JSON.stringify({ layout: "list", priorities: ["high"] }));
    expect(readQuery(stored)).toMatchObject({ cycles: [], modules: [] });
    const query = readQuery({ cycles: ["c1", "none"], modules: ["m1"], properties: ["cycle", "modules"] });
    expect(readQuery(JSON.parse(JSON.stringify(query)))).toEqual(query);
    expect(isIssueQuery(JSON.stringify(query))).toBe(true);
    expect(isIssueQuery('{"cycles":"c1"}')).toBe(false);
    expect(isIssueQuery('{"cycle":["c1"]}')).toBe(false);
    expect(DISPLAY_PROPERTIES).toContain("cycle");
    expect(DISPLAY_PROPERTIES).toContain("modules");
  });
});

describe("ordering", () => {
  const issues = [
    issue("i1", { priority: "low", createdAt: 3, updatedAt: 3, dueDate: "2026-10-01" }),
    issue("i2", { priority: "urgent", createdAt: 1, updatedAt: 9 }),
    issue("i3", { priority: "low", createdAt: 2, updatedAt: 2, dueDate: "2026-09-27" }),
    issue("i4", { priority: "none", createdAt: 4, updatedAt: 4, dueDate: "2026-09-27" }),
  ];
  test("by priority then newest, by creation, by last update", () => {
    expect(ids(sortIssues(issues, "priority"))).toEqual(["i2", "i1", "i3", "i4"]);
    expect(ids(sortIssues(issues, "created"))).toEqual(["i4", "i1", "i3", "i2"]);
    expect(ids(sortIssues(issues, "updated"))).toEqual(["i2", "i4", "i1", "i3"]);
  });

  test("by due date, soonest first and none last, ties by priority", () => {
    expect(ids(sortIssues(issues, "due"))).toEqual(["i3", "i4", "i1", "i2"]);
  });

  test("issues created together keep one order: the higher number first", () => {
    const together = [issue("i7"), issue("i9"), issue("i8")];
    expect(ids(sortIssues(together, "created"))).toEqual(["i9", "i8", "i7"]);
    expect(ids(sortIssues([...together].reverse(), "priority"))).toEqual(["i9", "i8", "i7"]);
  });

  test("patching a sorted list gives what sorting again would", () => {
    const sorted = sortIssues(issues, "priority");
    const [i1, i2, i3] = issues as [Row<"Issue">, Row<"Issue">, Row<"Issue">];
    const moved = { ...i3, priority: "urgent" as const };
    const added = issue("i5", { priority: "medium", createdAt: 5 });
    const patched = patchSorted(sorted, "priority", [i3, i1], [moved, added]);
    expect(patched).toEqual(sortIssues([i2, moved, issues[3] as Row<"Issue">, added], "priority"));
    expect(ids(sorted)).toEqual(["i2", "i1", "i3", "i4"]);
    // A row that is not in the list is not taken out of it.
    expect(patchSorted(sorted, "priority", [added], [])).toEqual(sorted);
  });
});

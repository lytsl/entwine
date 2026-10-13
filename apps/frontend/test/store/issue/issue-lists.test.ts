import { describe, expect, test } from "bun:test";
import { DEFAULT_QUERY, type IssueQuery, type Row } from "@entwine/shared";
import { IssueIndex } from "../../../src/store/issue/issue-index";
import { IssueLists, NEWEST, type Scope } from "../../../src/store/issue/issue-lists";
import type { ChangeSource } from "../../../src/store/row-store";
import { issue } from "../../helpers/issue";

type Issue = Row<"Issue">;
type Listener = Parameters<ChangeSource<Issue>["subscribeChanges"]>[0];

function open(issues: Issue[]) {
  let listener: Listener = () => {};
  const none = { subscribeChanges: () => ({ unsubscribe() {} }) };
  const index = new IssueIndex({
    Issue: {
      subscribeChanges(to) {
        listener = to;
        to(issues.map((value) => ({ type: "insert", value })));
        return { unsubscribe() {} };
      },
    },
    IssueLabel: none,
    IssueModule: none,
    IssueLink: none,
  });
  // Counts the issues a scope is asked about, which is every issue when a list is worked out.
  let asked = 0;
  const scope = (key: string, has: (issue: Issue) => boolean): Scope => ({
    key,
    has(issue) {
      asked++;
      return has(issue);
    },
  });
  const lists = new IssueLists(index, {
    states: new Map([["todo", { group: "unstarted" }]]),
    projects: new Map([
      ["p1", { identifier: "P" }],
      ["p2", { identifier: "Q" }],
    ]),
    labelsOf: () => [],
    modulesOf: () => [],
  });
  return {
    lists,
    scope,
    put: (...values: Issue[]) => listener(values.map((value) => ({ type: "update", value }))),
    passes() {
      const count = asked;
      asked = 0;
      return count;
    },
  };
}
const ids = (issues: Issue[]) => issues.map((i) => i.id);

describe("issue lists", () => {
  test("lists a scope's issues in the query's order", () => {
    const { lists, scope } = open([issue("i1"), issue("i2", { priority: "high" }), issue("i3", { projectId: "p2" })]);
    const mine = scope("p1", (i) => i.projectId === "p1");
    expect(ids(lists.issues(mine))).toEqual(["i2", "i1"]);
    expect(ids(lists.issues(mine, { ...NEWEST, priorities: ["high"] }))).toEqual(["i2"]);
  });

  test("patches a kept list with the issues an edit touched", () => {
    const { lists, scope, put, passes } = open([issue("i1"), issue("i2"), issue("i3")]);
    const all = scope("all", (i) => i.archivedAt === null);
    const query: IssueQuery = { ...DEFAULT_QUERY, order: "priority" };
    const first = lists.issues(all, query);
    expect(passes()).toBe(3);
    expect(lists.issues(all, query)).toBe(first);
    put(issue("i1", { priority: "urgent" }));
    expect(ids(lists.issues(all, query))).toEqual(["i1", "i3", "i2"]);
    put(issue("i3", { archivedAt: 1 }));
    expect(ids(lists.issues(all, query))).toEqual(["i1", "i2"]);
    // Only the touched issues were asked about.
    expect(passes()).toBe(2);
  });

  test("keeps a list through a change of layout, grouping and properties", () => {
    const { lists, scope, passes } = open([issue("i1"), issue("i2")]);
    const all = scope("all", () => true);
    const first = lists.issues(all, DEFAULT_QUERY);
    passes();
    expect(lists.issues(all, { ...DEFAULT_QUERY, layout: "board", group: "priority", properties: [] })).toBe(first);
    // A scope made again with the same key is the same scope.
    expect(
      lists.issues(
        scope("all", () => true),
        DEFAULT_QUERY,
      ),
    ).toBe(first);
    expect(passes()).toBe(0);
  });

  test("keeps the lists of two questions about one scope", () => {
    const { lists, scope, passes } = open([issue("i1"), issue("i2")]);
    const all = scope("all", () => true);
    const filtered = { ...DEFAULT_QUERY, q: "issue i1" };
    lists.issues(all, DEFAULT_QUERY);
    expect(ids(lists.issues(all, filtered))).toEqual(["i1"]);
    passes();
    lists.issues(all, DEFAULT_QUERY);
    lists.issues(all, filtered);
    expect(passes()).toBe(0);
  });
});

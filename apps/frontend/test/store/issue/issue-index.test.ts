import { describe, expect, test } from "bun:test";
import type { Row } from "@entwine/shared";
import { IssueIndex } from "../../../src/store/issue/issue-index";
import type { ChangeSource } from "../../../src/store/row-store";

type Change<T> = Parameters<Parameters<ChangeSource<T>["subscribeChanges"]>[0]>[0][number];

/** A collection as far as the index knows one: rows, and listeners told of each change. */
function source<T extends { id: string }>(rows: T[] = []) {
  const held = new Map(rows.map((row) => [row.id, row]));
  const listeners = new Set<(changes: Change<T>[]) => void>();
  const emit = (changes: Change<T>[]) => {
    for (const listener of listeners) listener(changes);
  };
  return {
    listeners,
    subscribeChanges(listener: (changes: Change<T>[]) => void) {
      listeners.add(listener);
      if (held.size) listener([...held.values()].map((value) => ({ type: "insert", value })));
      return { unsubscribe: () => void listeners.delete(listener) };
    },
    put(...values: T[]) {
      emit(
        values.map((value) => {
          const type = held.has(value.id) ? "update" : "insert";
          held.set(value.id, value);
          return { type, value };
        }),
      );
    },
    remove(id: string) {
      const value = held.get(id) as T;
      held.delete(id);
      emit([{ type: "delete", value }]);
    },
  };
}

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

function open(issues: Row<"Issue">[] = []) {
  const sources = {
    Issue: source(issues),
    IssueLabel: source<Row<"IssueLabel">>(),
    IssueModule: source<Row<"IssueModule">>(),
    IssueLink: source<Row<"IssueLink">>(),
  };
  return { sources, index: new IssueIndex(sources) };
}
const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

describe("issue index", () => {
  test("starts from the rows the collections hold", () => {
    const { index } = open([issue("i1"), issue("i2", { parentId: "i1", cycleId: "c1" })]);
    expect(ids([...index.issues.values()])).toEqual(["i1", "i2"]);
    expect(ids(index.childrenOf("i1"))).toEqual(["i2"]);
  });

  test("moves an issue between parents", () => {
    const { sources, index } = open([issue("i1"), issue("i2"), issue("i3", { parentId: "i1", cycleId: "c1" })]);
    sources.Issue.put(issue("i3", { parentId: "i2", cycleId: "c2" }));
    expect(index.childrenOf("i1")).toEqual([]);
    expect(ids(index.childrenOf("i2"))).toEqual(["i3"]);
    sources.Issue.remove("i3");
    expect(index.childrenOf("i2")).toEqual([]);
    expect(index.issues.has("i3")).toBe(false);
  });

  test("keeps an issue's labels, modules and link count", () => {
    const { sources, index } = open([issue("i1")]);
    sources.IssueLabel.put(
      { id: "i1:bug", issueId: "i1", labelId: "bug" },
      { id: "i1:ui", issueId: "i1", labelId: "ui" },
    );
    sources.IssueModule.put({ id: "i1:m1", issueId: "i1", moduleId: "m1" });
    sources.IssueLink.put({ id: "l1", issueId: "i1" } as Row<"IssueLink">);
    expect(index.labelsOf("i1")).toEqual(["bug", "ui"]);
    expect(index.modulesOf("i1")).toEqual(["m1"]);
    expect(index.inModule("m1", "i1")).toBe(true);
    expect(index.linkCount("i1")).toBe(1);
    sources.IssueLabel.remove("i1:bug");
    sources.IssueModule.remove("i1:m1");
    sources.IssueLink.remove("l1");
    expect(index.labelsOf("i1")).toEqual(["ui"]);
    expect(index.inModule("m1", "i1")).toBe(false);
    expect(index.linkCount("i1")).toBe(0);
  });

  test("counts a project's issues by state", () => {
    const { sources, index } = open([issue("i1"), issue("i2"), issue("i3", { stateId: "done" })]);
    expect([...index.stateCounts("p1")]).toEqual([
      ["todo", 2],
      ["done", 1],
    ]);
    sources.Issue.put(issue("i1", { stateId: "done" }), issue("i2", { projectId: "p2" }));
    sources.Issue.remove("i3");
    expect(index.stateCounts("p1").get("todo")).toBe(0);
    expect(index.stateCounts("p1").get("done")).toBe(1);
    expect(index.stateCounts("p2").get("todo")).toBe(1);
    expect(index.stateCounts("p3").size).toBe(0);
  });

  test("counts a cycle's and a module's issues by state, and those archived", () => {
    const { sources, index } = open([issue("i1", { cycleId: "c1" }), issue("i2", { cycleId: "c1", stateId: "done" })]);
    sources.IssueModule.put(
      { id: "i1:m1", issueId: "i1", moduleId: "m1" },
      { id: "i9:m1", issueId: "i9", moduleId: "m1" },
    );
    expect([...index.stateCounts("c1")]).toEqual([
      ["todo", 1],
      ["done", 1],
    ]);
    expect([...index.stateCounts("m1")]).toEqual([["todo", 1]]);
    // An issue that arrives after its membership is counted then.
    sources.Issue.put(issue("i9", { stateId: "done" }));
    expect(index.stateCounts("m1").get("done")).toBe(1);
    sources.Issue.put(issue("i1", { cycleId: "c2", stateId: "done", archivedAt: 5 }));
    expect(index.stateCounts("c1").get("todo")).toBe(0);
    expect(index.stateCounts("c2").get("done")).toBe(1);
    expect(index.stateCounts("m1").get("todo")).toBe(0);
    expect(index.stateCounts("m1").get("done")).toBe(2);
    expect(["c2", "m1", "p1", "c1"].map((id) => index.archivedIn(id))).toEqual([1, 1, 1, 0]);
    sources.IssueModule.remove("i1:m1");
    expect(index.stateCounts("m1").get("done")).toBe(1);
    expect(index.archivedIn("m1")).toBe(0);
    sources.Issue.remove("i9");
    expect(index.stateCounts("m1").get("done")).toBe(0);
  });

  test("sums a cycle's and a module's estimate points by state, as states and estimates change", () => {
    const { sources, index } = open([
      issue("i1", { cycleId: "c1", estimate: 5 }),
      issue("i2", { cycleId: "c1", estimate: 3 }),
      issue("i3", { cycleId: "c1" }),
    ]);
    sources.IssueModule.put(
      { id: "i1:m1", issueId: "i1", moduleId: "m1" },
      { id: "i2:m1", issueId: "i2", moduleId: "m1" },
    );
    const points = (holderId: string) => Object.fromEntries(index.statePoints(holderId));
    expect(points("c1")).toEqual({ todo: 8 });
    expect(points("m1")).toEqual({ todo: 8 });
    expect(index.statePoints("c9").size).toBe(0);
    sources.Issue.put(issue("i1", { cycleId: "c1", estimate: 5, stateId: "done" }));
    expect(points("m1")).toEqual({ todo: 3, done: 5 });
    sources.Issue.put(issue("i1", { cycleId: "c1", estimate: 2, stateId: "done" }));
    expect(points("m1")).toEqual({ todo: 3, done: 2 });
    expect(points("c1")).toEqual({ todo: 3, done: 2 });
    sources.Issue.put(issue("i2", { cycleId: "c2", estimate: null }));
    expect(points("c1")).toEqual({ todo: 0, done: 2 });
    expect(points("m1")).toEqual({ todo: 0, done: 2 });
    sources.IssueModule.remove("i1:m1");
    expect(points("m1")).toEqual({ todo: 0, done: 0 });
    // The counts are untouched by estimates.
    expect(index.stateCounts("c1").get("todo")).toBe(1);
  });

  test("counts a label's uses once, however often a link arrives", () => {
    const { sources, index } = open([issue("i1"), issue("i2")]);
    const link = { id: "i1:bug", issueId: "i1", labelId: "bug" };
    sources.IssueLabel.put(link, { id: "i2:bug", issueId: "i2", labelId: "bug" });
    sources.IssueLabel.put(link);
    expect(index.labelUses("bug")).toBe(2);
    sources.IssueLabel.remove("i1:bug");
    expect(index.labelUses("bug")).toBe(1);
    expect(index.labelUses("ui")).toBe(0);
  });

  test("counts a revision for the issue a change shows on, and for its parent", () => {
    const { sources, index } = open([issue("i1"), issue("i2", { parentId: "i1" }), issue("i3")]);
    const before = ["i1", "i2", "i3"].map((id) => index.rev(id));
    sources.Issue.put(issue("i2", { parentId: "i1", stateId: "done" }));
    sources.IssueLabel.put({ id: "i2:bug", issueId: "i2", labelId: "bug" });
    const after = ["i1", "i2", "i3"].map((id) => index.rev(id));
    expect(after[0]).toBe((before[0] as number) + 1);
    expect(after[1]).toBe((before[1] as number) + 2);
    expect(after[2]).toBe(before[2] as number);
  });

  test("lists the issues touched since a version, while it remembers", () => {
    const { sources, index } = open([issue("i1"), issue("i2"), issue("i3")]);
    const start = index.version;
    expect(index.touchedSince(start)).toEqual([]);
    sources.Issue.put(issue("i1", { priority: "high" }));
    sources.IssueLabel.put({ id: "i2:bug", issueId: "i2", labelId: "bug" });
    expect([...(index.touchedSince(start) ?? [])].sort()).toEqual(["i1", "i2"]);
    expect(index.touchedSince(start + 1)).toEqual(["i2"]);
    for (let n = 0; n < 40; n++) sources.Issue.put(issue("i3", { updatedAt: n }));
    expect(index.touchedSince(start)).toBe(null);
  });

  test("does not list a change that touches many issues", () => {
    const { sources, index } = open([issue("i1")]);
    const start = index.version;
    sources.Issue.put(...Array.from({ length: 1001 }, (_, n) => issue(`i${n + 2}`)));
    expect(index.touchedSince(start)).toBe(null);
    expect(index.issues.size).toBe(1002);
  });

  test("tells its listeners, and follows the collections only while it has any", () => {
    const { sources, index } = open([issue("i1")]);
    let calls = 0;
    const stop = index.listen(() => calls++);
    sources.Issue.put(issue("i2"));
    expect(calls).toBe(1);
    stop();
    expect(sources.Issue.listeners.size).toBe(0);
    sources.Issue.put(issue("i3"));
    // Listening again starts from the rows as they are now.
    index.listen(() => {});
    expect(ids([...index.issues.values()])).toEqual(["i1", "i2", "i3"]);
  });
});

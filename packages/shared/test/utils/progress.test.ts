import { describe, expect, test } from "bun:test";
import { progress, type StateGroup } from "../../src";

describe("progress", () => {
  const of = (groups: StateGroup[]) => progress(groups, (g) => g);

  test("is completed out of the issues that are not cancelled, with every issue in the group counts", () => {
    const p = of(["completed", "cancelled", "started", "started"]);
    expect(p).toMatchObject({ total: 4, done: 1, planned: 3 });
    expect(p.percent).toBeCloseTo(100 / 3);
    expect(p.groups).toEqual({ backlog: 0, unstarted: 0, started: 2, completed: 1, cancelled: 1 });
  });

  test("is 0% when there is nothing to count, or only cancelled issues", () => {
    expect(of([])).toMatchObject({ total: 0, planned: 0, percent: 0 });
    expect(of(["cancelled", "cancelled"])).toMatchObject({ total: 2, planned: 0, percent: 0 });
    expect(Number.isFinite(of(["cancelled"]).percent)).toBe(true);
  });

  test("counts each issue it is given once, and sub-issues only when they are given", () => {
    const issues = [
      { id: "parent", parentId: null, group: "started" as const },
      { id: "child", parentId: "parent", group: "completed" as const },
    ];
    const assigned = issues.filter((i) => i.id === "parent");
    expect(progress(assigned, (i) => i.group)).toMatchObject({ total: 1, done: 0 });
    expect(progress(issues, (i) => i.group)).toMatchObject({ total: 2, done: 1 });
  });

  test("by estimate, an issue weighs its points, and nothing without an estimate", () => {
    const issues: { group: StateGroup; estimate: number | null }[] = [
      { group: "completed", estimate: 5 },
      { group: "started", estimate: 3 },
      { group: "started", estimate: null },
      { group: "cancelled", estimate: 8 },
    ];
    expect(progress(issues, (i) => i.group)).toMatchObject({ done: 1, planned: 3 });
    const points = progress(
      issues,
      (i) => i.group,
      (i) => i.estimate ?? 0,
    );
    expect(points).toMatchObject({ done: 5, planned: 8, total: 16 });
    expect(points.percent).toBeCloseTo(62.5);
    const unestimated = progress(
      issues.filter((i) => i.estimate === null),
      (i) => i.group,
      (i) => i.estimate ?? 0,
    );
    expect(unestimated).toMatchObject({ planned: 0, percent: 0 });
  });

  test("an issue in two modules counts once in each", () => {
    const memberships = { m1: ["i1", "i2"], m2: ["i1"] };
    const group = (id: string): StateGroup => (id === "i1" ? "completed" : "started");
    expect(progress(memberships.m1, group)).toMatchObject({ total: 2, done: 1 });
    expect(progress(memberships.m2, group)).toMatchObject({ total: 1, done: 1, percent: 100 });
  });
});

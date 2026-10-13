import { describe, expect, test } from "bun:test";
import { progressOfCounts } from "@entwine/shared";
import { cyclePhase, pointsDone, wholePercent, withRolled } from "../../src/lib/plan";

describe("cycle phase", () => {
  const cycle = { startDate: "2026-10-01", endDate: "2026-10-14" };

  test("is upcoming before the start, current from the start through the end, and past after it", () => {
    expect(cyclePhase(cycle, "2026-09-30")).toBe("upcoming");
    expect(cyclePhase(cycle, "2026-10-01")).toBe("current");
    expect(cyclePhase(cycle, "2026-10-14")).toBe("current");
    expect(cyclePhase(cycle, "2026-10-15")).toBe("past");
  });

  test("a one-day cycle is current on that day only, across month and year ends", () => {
    const day = { startDate: "2026-12-31", endDate: "2026-12-31" };
    expect(cyclePhase(day, "2026-12-30")).toBe("upcoming");
    expect(cyclePhase(day, "2026-12-31")).toBe("current");
    expect(cyclePhase(day, "2027-01-01")).toBe("past");
  });
});

describe("points", () => {
  test("are said as done of planned, and left out where nothing counted has an estimate", () => {
    expect(
      pointsDone(
        progressOfCounts([
          ["completed", 5],
          ["started", 3],
          ["cancelled", 8],
        ]),
      ),
    ).toBe("5 of 8 points");
    expect(pointsDone(progressOfCounts([["started", 1]]))).toBe("0 of 1 point");
    expect(pointsDone(progressOfCounts([["cancelled", 8]]))).toBeNull();
    expect(pointsDone(progressOfCounts([]))).toBeNull();
  });
});

describe("a whole percentage", () => {
  const of = (done: number, open: number) =>
    wholePercent(
      progressOfCounts([
        ["completed", done],
        ["started", open],
      ]),
    );

  test("says 100 only once everything is done, and 0 only while nothing is", () => {
    expect(of(0, 0)).toBe(0);
    expect(of(0, 5)).toBe(0);
    expect(of(1, 400)).toBe(1);
    expect(of(1, 1)).toBe(50);
    expect(of(399, 1)).toBe(99);
    expect(of(4, 0)).toBe(100);
  });
});

test("what a cycle's rollover moved on stays planned in it, so it does not read as finished", () => {
  const left = progressOfCounts([
    ["completed", 2],
    ["cancelled", 1],
  ]);
  expect(left.percent).toBe(100);
  expect(withRolled(left, 2)).toMatchObject({ done: 2, planned: 4, total: 5, percent: 50 });
  expect(withRolled(left, 0)).toBe(left);
});

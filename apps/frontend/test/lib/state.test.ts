import { expect, test } from "bun:test";
import type { StateGroup } from "@entwine/shared";
import { sortStates } from "../../src/lib/state";

test("states sort by group, then position, then id", () => {
  const state = (id: string, group: StateGroup, position: number) => ({ id, group, position });
  const sorted = sortStates([
    state("done", "completed", 0),
    state("review", "started", 5),
    state("b", "started", 1),
    state("a", "started", 1),
    state("backlog", "backlog", 9),
  ]);
  expect(sorted.map((s) => s.id)).toEqual(["backlog", "a", "b", "review", "done"]);
});

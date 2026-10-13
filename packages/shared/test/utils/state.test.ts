import { expect, test } from "bun:test";
import { defaultStates, rowSchemas } from "../../src";

test("default states are derived from the project, one per group in workflow order", () => {
  const states = defaultStates("p1");
  expect(states.map((s) => [s.id, s.position])).toEqual([
    ["p1:backlog", 0],
    ["p1:unstarted", 1],
    ["p1:started", 2],
    ["p1:completed", 3],
    ["p1:cancelled", 4],
  ]);
  for (const state of states) expect(rowSchemas.State.safeParse(state).success).toBe(true);
});

import { expect, test } from "bun:test";
import { relationSide } from "../../../src";

test("a relation reads from each of its issues", () => {
  const blocks = { issueId: "a", relatedId: "b", type: "blocks" as const };
  expect(relationSide(blocks, "a")).toEqual({ side: "blocks", otherId: "b" });
  expect(relationSide(blocks, "b")).toEqual({ side: "blocked_by", otherId: "a" });
  expect(relationSide({ ...blocks, type: "duplicate" }, "b")).toEqual({ side: "duplicate", otherId: "a" });
});

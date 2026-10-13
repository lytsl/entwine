import { expect, test } from "bun:test";
import { issueRelationId, pairId, reactionId } from "../../src";

test("a derived id is its pair, joined with a colon", () => {
  expect(pairId("i", "l")).toBe("i:l");
});

test("a relation's id is the same whichever issue it starts from", () => {
  expect(issueRelationId("b", "a")).toBe("a:b");
  expect(issueRelationId("a", "b")).toBe("a:b");
});

test("a reaction's id names its target, its member and its emoji", () => {
  expect(reactionId("c1", "ada", "👍")).toBe("c1:ada:👍");
});

import { expect, test } from "bun:test";
import { listNames } from "../../src/lib/member";

test("a long list of names ends by counting the rest", () => {
  expect(listNames([])).toBe("");
  expect(listNames(["Ada", "Bob"])).toBe("Ada, Bob");
  expect(listNames(["Ada", "Bob", "Cy"], 3)).toBe("Ada, Bob, Cy");
  expect(listNames(["Ada", "Bob", "Cy", "Di"], 2)).toBe("Ada, Bob and 2 more");
});

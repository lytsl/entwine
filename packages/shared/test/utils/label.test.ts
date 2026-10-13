import { expect, test } from "bun:test";
import { labelNameKey } from "../../src";

test("a label's key ignores case and outer spaces", () => {
  expect(labelNameKey("  Bug ")).toBe("bug");
});

import { expect, test } from "bun:test";
import { formatBytes } from "../../src/lib/files";

test("a file's size is read in the largest unit that keeps it above one", () => {
  expect(formatBytes(812)).toBe("812 B");
  expect(formatBytes(1024)).toBe("1 KB");
  expect(formatBytes(3_500)).toBe("3.4 KB");
  expect(formatBytes(250_000)).toBe("244 KB");
  expect(formatBytes(10 * 1024 * 1024)).toBe("10 MB");
});

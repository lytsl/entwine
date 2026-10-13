import { expect, test } from "bun:test";
import { passwordInput } from "../../src";

test("a new password is typed twice, is long enough and is not the current one", () => {
  const errors = (newPassword: string, confirmPassword = newPassword) => {
    const result = passwordInput.safeParse({ currentPassword: "password123", newPassword, confirmPassword });
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join());
  };
  expect(errors("another-password")).toEqual([]);
  expect(errors("short")).toEqual(["newPassword"]);
  expect(errors("password123")).toEqual(["newPassword"]);
  expect(errors("another-password", "another-pasword")).toEqual(["confirmPassword"]);
});

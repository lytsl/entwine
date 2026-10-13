import { afterEach, beforeEach, expect, test } from "bun:test";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("an account request larger than a form is refused", async () => {
  const ada = await t.signUp("ada");
  const response = await ada.fetch("/api/auth/update-user", {
    method: "POST",
    body: JSON.stringify({ image: `data:image/png;base64,${"A".repeat(70 * 1024)}` }),
  });
  expect(response.status).toBe(413);
});

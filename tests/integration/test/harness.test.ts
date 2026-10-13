import { expect, test } from "bun:test";
import { harness } from "./helpers/harness";

test("cleanup lets an in-flight signup finish before closing its auth database", async () => {
  const h = await harness();
  const response = h.request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ name: "Pending", email: "pending@example.com", password: "password123" }),
  });
  await h.cleanup();
  expect((await response).status).toBe(200);
});

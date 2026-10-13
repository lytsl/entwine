import { afterEach, beforeEach, expect, test } from "bun:test";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("a member's loads and writes are limited per minute, and another member's are not", async () => {
  await t.cleanup();
  t = await testServer({ requestsPerMinute: 3 });
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "member"]]);
  const load = (account: typeof ada) =>
    account.fetch(`/api/w/${id}/load`, { method: "POST", body: JSON.stringify({ queries: [{ model: "Label" }] }) });
  const statuses: number[] = [];
  let last = await load(bob);
  for (let i = 0; i < 4; i++) statuses.push((last = await load(bob)).status);
  expect(statuses.slice(-2)).toEqual([429, 429]);
  expect(Number(last.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(last.headers.get("X-RateLimit-Requests-Limit")).toBe("3");
  expect((await load(ada)).status).toBe(200);
});

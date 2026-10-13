import { afterEach, beforeEach, expect, test } from "bun:test";
import { loadAll } from "../helpers/requests";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("workspace data needs a session and membership", async () => {
  const ada = await t.signUp("ada");
  const eve = await t.signUp("eve");
  const id = await t.workspace(ada, "acme");
  expect((await t.request(`/api/w/${id}/load`, loadAll)).status).toBe(401);
  expect((await eve.fetch(`/api/w/${id}/load`, loadAll)).status).toBe(403);
  expect((await eve.fetch("/api/w/nope/load", loadAll)).status).toBe(403);
  expect((await ada.fetch(`/api/w/${id}/load`, loadAll)).status).toBe(200);
});

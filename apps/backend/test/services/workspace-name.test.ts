import { afterEach, beforeEach, expect, test } from "bun:test";
import type { LoadResponse } from "@entwine/sync-engine/protocol";
import { send } from "../helpers/requests";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

const stored = async (account: Account, id: string): Promise<unknown> =>
  ((await account.json(`/api/w/${id}/load`, { queries: [{ model: "Workspace" }] })) as LoadResponse).rows.Workspace;
const rename = (account: Account, id: string, data: Record<string, unknown>) =>
  account.fetch("/api/auth/organization/update", {
    method: "POST",
    body: JSON.stringify({ data, organizationId: id }),
  });
const listed = async (account: Account) =>
  (await account.json<{ name: string; slug: string }[]>("/api/auth/organization/list")).map((w) => [w.name, w.slug]);

test("owners and admins rename the workspace, members do not, and its store follows the name", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const cy = await t.signUp("cy");
  const id = await t.workspace(ada, "acme", [
    [bob, "admin"],
    [cy, "member"],
  ]);
  expect(await stored(cy, id)).toEqual([{ id, name: "acme" }]);

  expect((await rename(bob, id, { name: "  Acme Labs " })).status).toBe(200);
  expect(await stored(cy, id)).toEqual([{ id, name: "Acme Labs" }]);
  expect((await rename(cy, id, { name: "Mine" })).ok).toBe(false);
  expect((await rename(ada, id, { name: "Acme" })).status).toBe(200);
  expect(await listed(cy)).toEqual([["Acme", "acme"]]);
  expect(await stored(bob, id)).toEqual([{ id, name: "Acme" }]);
});

test("a workspace's slug cannot be changed", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const response = await rename(ada, id, { slug: "other" });
  expect(response.status).toBe(400);
  expect(((await response.json()) as { message: string }).message).toBe("A workspace's URL cannot be changed");
  expect(await listed(ada)).toEqual([["acme", "acme"]]);
});

test("clients cannot write the stored name, and a missing or wrong one is repaired by the next request", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const written = await send(ada, id, [{ model: "Workspace", type: "update", key: id, value: { name: "Mine" } }]);
  expect(written.status).toBe(403);

  const tenant = await t.server.tenants.tenant(id);
  await tenant.write((writer) => writer.update("Workspace", id, { name: "Stale" }));
  expect(await stored(ada, id)).toEqual([{ id, name: "acme" }]);
  await tenant.write((writer) => writer.delete("Workspace", id));
  expect(await stored(ada, id)).toEqual([{ id, name: "acme" }]);
});

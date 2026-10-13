import { afterEach, beforeEach, expect, test } from "bun:test";
import { loadAll, members } from "../helpers/requests";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("the member directory follows creation, invitations, role changes, profile edits and removal", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "member"]]);
  expect(t.mail.filter((m) => m.url.includes("/invite/")).map((m) => m.to)).toEqual(["bob@example.com"]);
  expect(await members(ada, id)).toEqual([
    ["ada", "owner", 0],
    ["bob", "member", 0],
  ]);

  const { members: list } = await ada.json<{ members: { id: string; userId: string }[] }>(
    `/api/auth/organization/get-full-organization?organizationId=${id}`,
  );
  const bobMember = list.find((m) => m.userId === bob.id)!;
  await ada.json("/api/auth/organization/update-member-role", {
    memberId: bobMember.id,
    role: "admin",
    organizationId: id,
  });
  await bob.json("/api/auth/update-user", { name: "Robert" });
  expect(await members(ada, id)).toEqual([
    ["ada", "owner", 0],
    ["Robert", "admin", 0],
  ]);

  await ada.json("/api/auth/organization/remove-member", { memberIdOrEmail: bobMember.id, organizationId: id });
  expect(await members(ada, id)).toEqual([
    ["ada", "owner", 0],
    ["Robert", "admin", 1],
  ]);
  expect((await bob.fetch(`/api/w/${id}/load`, loadAll)).status).toBe(403);
});

test("a missing directory entry is repaired by the member's next request", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const tenant = await t.server.tenants.tenant(id);
  await tenant.write((writer) => writer.delete("Member", ada.id));
  expect(await members(ada, id)).toEqual([["ada", "owner", 0]]);
});

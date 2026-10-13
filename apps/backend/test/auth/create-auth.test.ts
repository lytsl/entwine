import { afterEach, beforeEach, expect, test } from "bun:test";
import { members } from "../helpers/requests";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("slugs are unique", async () => {
  const ada = await t.signUp("ada");
  await t.workspace(ada, "acme");
  const again = await ada.fetch("/api/auth/organization/create", {
    method: "POST",
    body: JSON.stringify({ name: "Acme", slug: "acme" }),
  });
  expect(again.ok).toBe(false);
});

test("members cannot invite, and the only owner cannot leave", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "member"]]);
  const invite = await bob.fetch("/api/auth/organization/invite-member", {
    method: "POST",
    body: JSON.stringify({ email: "cy@example.com", role: "member", organizationId: id }),
  });
  expect(invite.ok).toBe(false);
  const leave = await ada.fetch("/api/auth/organization/leave", {
    method: "POST",
    body: JSON.stringify({ organizationId: id }),
  });
  expect(leave.ok).toBe(false);
  const { members: list } = await ada.json<{ members: { id: string; userId: string }[] }>(
    `/api/auth/organization/get-full-organization?organizationId=${id}`,
  );
  const demote = await ada.fetch("/api/auth/organization/update-member-role", {
    method: "POST",
    body: JSON.stringify({ memberId: list.find((m) => m.userId === ada.id)!.id, role: "member", organizationId: id }),
  });
  expect(demote.ok).toBe(false);
});

test("an admin cannot make an owner, nor change or remove one", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const cy = await t.signUp("cy");
  const id = await t.workspace(ada, "acme", [
    [bob, "admin"],
    [cy, "member"],
  ]);
  const full = await ada.json<{ members: { id: string; userId: string }[] }>(
    `/api/auth/organization/get-full-organization?organizationId=${id}`,
  );
  const memberId = (account: { id: string }) => full.members.find((m) => m.userId === account.id)?.id;
  const asBob = (path: string, body: Record<string, unknown>) =>
    bob.fetch(`/api/auth/organization/${path}`, {
      method: "POST",
      body: JSON.stringify({ organizationId: id, ...body }),
    });
  expect((await asBob("update-member-role", { memberId: memberId(cy), role: "owner" })).ok).toBe(false);
  expect((await asBob("update-member-role", { memberId: memberId(ada), role: "member" })).ok).toBe(false);
  expect((await asBob("remove-member", { memberIdOrEmail: memberId(ada) })).ok).toBe(false);
  expect((await asBob("invite-member", { email: "dee@example.com", role: "owner" })).ok).toBe(false);
  expect(await members(ada, id)).toEqual([
    ["ada", "owner", 0],
    ["bob", "admin", 0],
    ["cy", "member", 0],
  ]);
  expect((await asBob("update-member-role", { memberId: memberId(cy), role: "admin" })).ok).toBe(true);
});

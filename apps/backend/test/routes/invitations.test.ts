import { afterEach, beforeEach, expect, test } from "bun:test";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("an invitation names its address and whether it has an account, to anyone holding its id", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const organizationId = await t.workspace(ada, "acme");
  const invite = (email: string) =>
    ada.json<{ id: string }>("/api/auth/organization/invite-member", { email, role: "member", organizationId });
  const toBob = await invite(bob.email);
  const toNew = await invite("new@example.com");

  expect(await (await t.request(`/api/invitations/${toBob.id}`)).json()).toEqual({
    email: bob.email,
    account: true,
  });
  expect(await (await t.request(`/api/invitations/${toNew.id}`)).json()).toEqual({
    email: "new@example.com",
    account: false,
  });

  await ada.json("/api/auth/organization/cancel-invitation", { invitationId: toNew.id });
  expect((await t.request(`/api/invitations/${toNew.id}`)).status).toBe(404);
  expect((await t.request(`/api/invitations/${crypto.randomUUID()}`)).status).toBe(404);
});

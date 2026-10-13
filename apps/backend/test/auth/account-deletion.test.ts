import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
afterEach(() => t.cleanup());

const deleteAccount = (account: Account) => account.fetch("/api/auth/delete-user", { method: "POST", body: "{}" });
const signIn = (name: string) =>
  t.request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: `${name}@example.com`, password: "password123" }),
  });
const directory = async (account: Account, id: string) =>
  (
    await account.json<{ rows: { Member: { id: string; email: string; image: string | null; removed: number }[] } }>(
      `/api/w/${id}/load`,
      { queries: [{ model: "Member" }] },
    )
  ).rows.Member;

test("a member who deletes their account leaves its workspaces, keeping their name and nothing else", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "admin"]]);
  const png = Uint8Array.from(
    atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
    (c) => c.charCodeAt(0),
  );
  const { image } = await (
    await bob.fetch("/api/avatar", { method: "PUT", headers: { "Content-Type": "image/png" }, body: png })
  ).json();
  await bob.json("/api/auth/push/subscribe", {
    endpoint: "https://fcm.googleapis.com/fcm/send/bob",
    keys: { p256dh: "key", auth: "secret" },
  });

  expect((await deleteAccount(bob)).status).toBe(200);
  expect((await signIn("bob")).ok).toBe(false);
  expect(await (await bob.fetch("/api/auth/get-session")).json()).toBeNull();
  expect((await directory(ada, id)).find((m) => m.id === bob.id)).toMatchObject({ email: "", image: null, removed: 1 });
  const { database } = t.server.auth;
  expect(existsSync(join(database.filename, "..", "avatars", image.split("/").at(-1)))).toBe(false);
  expect(database.query('SELECT COUNT(*) AS n FROM "pushSubscription"').get()).toEqual({ n: 0 });
});

test("the only owner of a workspace with other members cannot delete their account", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  await t.workspace(ada, "acme", [[bob, "admin"]]);
  await t.workspace(ada, "beta", [[bob, "member"]]);
  const refused = await deleteAccount(ada);
  expect(refused.status).toBe(400);
  expect(((await refused.json()) as { message: string }).message).toBe(
    'You are the only owner of "acme" and "beta". Transfer them to another member, or delete them, first.',
  );
  expect((await signIn("ada")).ok).toBe(true);
});

test("a workspace of which the account is the only member is deleted with it", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "solo");
  expect((await deleteAccount(ada)).status).toBe(200);
  expect(t.server.auth.workspaceExists(id)).toBe(false);
  expect(existsSync(join(t.server.auth.database.filename, "..", "tenants", `${id}.db`))).toBe(false);
});

test("a session opened more than a day ago is asked to sign in again", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  // No endpoint makes an old session; the clock of a day is Better Auth's.
  t.server.auth.database
    .query('UPDATE session SET "createdAt" = ? WHERE "userId" = ?')
    .run(new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), ada.id);
  const refused = await deleteAccount(ada);
  expect(refused.status).toBe(400);
  expect(((await refused.json()) as { code: string }).code).toBe("SESSION_EXPIRED");
  expect((await signIn("ada")).ok).toBe(true);
});

test("an owner transfers a workspace by making a member owner and becoming an admin", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "admin"]]);
  const { members } = await ada.json<{ members: { id: string; userId: string }[] }>(
    `/api/auth/organization/get-full-organization?organizationId=${id}`,
  );
  const memberOf = (account: Account) => members.find((m) => m.userId === account.id)!.id;
  await ada.json("/api/auth/organization/update-member-role", {
    memberId: memberOf(bob),
    role: "owner",
    organizationId: id,
  });
  await ada.json("/api/auth/organization/update-member-role", {
    memberId: memberOf(ada),
    role: "admin",
    organizationId: id,
  });
  const roles = (await directory(ada, id)).map((m) => [m.id, (m as unknown as { role: string }).role]);
  expect(Object.fromEntries(roles)).toEqual({ [ada.id]: "admin", [bob.id]: "owner" });
});

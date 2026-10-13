import { afterEach, beforeEach, expect, test } from "bun:test";
import { members } from "../helpers/requests";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

test("an instance with workspace creation switched off refuses a new workspace", async () => {
  const closed = await testServer({ workspaceCreation: false });
  try {
    const ada = await closed.signUp("ada");
    const refused = await ada.fetch("/api/auth/organization/create", {
      method: "POST",
      body: JSON.stringify({ name: "Acme", slug: "acme" }),
    });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { message: string }).message).toBe("Workspace creation is not allowed");
    expect(await ada.json<unknown[]>("/api/auth/organization/list")).toEqual([]);
  } finally {
    await closed.cleanup();
  }
});

test("a slug that is malformed, or the path of an app page, is refused", async () => {
  const ada = await t.signUp("ada");
  for (const slug of ["login", "signup", "new", "invite", "api", "a/b?c#d", "Acme", "a"]) {
    const response = await ada.fetch("/api/auth/organization/create", {
      method: "POST",
      body: JSON.stringify({ name: "Acme", slug }),
    });
    expect([slug, response.status]).toEqual([slug, 400]);
  }
  const id = await t.workspace(ada, "acme");
  const rename = await ada.fetch("/api/auth/organization/update", {
    method: "POST",
    body: JSON.stringify({ data: { slug: "login" }, organizationId: id }),
  });
  expect(rename.status).toBe(400);
});

test("names are trimmed, and a blank or overlong one is refused", async () => {
  const signUp = (name: string, email: string) =>
    t.request("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ name, email, password: "password123" }),
    });
  for (const name of ["", "   ", "n".repeat(256)]) expect((await signUp(name, "blank@example.com")).status).toBe(400);
  const padded = (await (await signUp("  Eve  ", "eve@example.com")).json()) as { user: { name: string } };
  expect(padded.user.name).toBe("Eve");

  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const rename = (name: string) =>
    ada.fetch("/api/auth/update-user", { method: "POST", body: JSON.stringify({ name }) });
  for (const name of ["", "n".repeat(256)]) expect((await rename(name)).status).toBe(400);
  expect(await members(ada, id)).toEqual([["ada", "owner", 0]]);
  expect((await rename(" Ada L. ")).status).toBe(200);
  expect(await members(ada, id)).toEqual([["Ada L.", "owner", 0]]);

  const create = (name: string, slug: string) =>
    ada.fetch("/api/auth/organization/create", { method: "POST", body: JSON.stringify({ name, slug }) });
  for (const name of ["  ", "w".repeat(81)]) expect((await create(name, "another")).status).toBe(400);
  expect((await create("w".repeat(80), "another")).status).toBe(200);
  const update = await ada.fetch("/api/auth/organization/update", {
    method: "POST",
    body: JSON.stringify({ data: { name: "w".repeat(81) }, organizationId: id }),
  });
  expect(update.status).toBe(400);
});

test("only those who may invite see pending invitations", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "member"]]);
  await ada.json("/api/auth/organization/invite-member", {
    email: "cy@example.com",
    role: "member",
    organizationId: id,
  });
  type Full = { members: unknown[]; invitations: { email: string }[] };
  const full = (account: typeof ada) =>
    account.json<Full>(`/api/auth/organization/get-full-organization?organizationId=${id}`);
  expect((await full(ada)).invitations.map((i) => i.email)).toContain("cy@example.com");
  expect(await full(bob)).toMatchObject({ members: [{}, {}], invitations: [] });
  const list = `/api/auth/organization/list-invitations?organizationId=${id}`;
  expect((await ada.fetch(list)).status).toBe(200);
  expect((await bob.fetch(list)).status).toBe(403);
});

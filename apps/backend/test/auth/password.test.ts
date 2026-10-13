import { afterEach, beforeEach, expect, test } from "bun:test";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
const signIn = (password: string) =>
  t.request("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email: "ada@example.com", password }),
  });
const session = async (cookie: string) =>
  (await (await t.request("/api/auth/get-session", {}, cookie)).json()) as { user: { id: string } } | null;

test("a password is changed with the current one, and the change signs out the other sessions", async () => {
  const ada = await t.signUp("ada");
  const elsewhere = cookieOf(await signIn("password123"));
  expect((await session(elsewhere))?.user.id).toBe(ada.id);
  const change = (currentPassword: string, newPassword: string, extra = {}) =>
    ada.fetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword, ...extra }),
    });

  expect((await change("wrong-password", "another-password")).status).toBe(400);
  expect((await change("password123", "short")).status).toBe(400);
  expect((await signIn("password123")).status).toBe(200);

  // Whatever the client asks for, the other sessions end.
  const changed = await change("password123", "another-password", { revokeOtherSessions: false });
  expect(changed.status).toBe(200);
  expect(await session(elsewhere)).toBeNull();
  expect((await session(cookieOf(changed)))?.user.id).toBe(ada.id);
  expect((await signIn("password123")).ok).toBe(false);
  expect((await signIn("another-password")).status).toBe(200);
});

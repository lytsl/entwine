import { afterEach, expect, test } from "bun:test";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
afterEach(() => t.cleanup());

const post = (path: string, body: unknown) => t.request(path, { method: "POST", body: JSON.stringify(body) });
const signIn = (password: string) => post("/api/auth/sign-in/email", { email: "ada@example.com", password });
const resetMail = (to: string) => t.mailed((m) => m.to === to && m.subject === "Reset your entwine password");

/** Follows the mailed link as a browser does, to the page that reads the token. */
async function tokenOf(url: string): Promise<string> {
  const response = await t.request(new URL(url).pathname + new URL(url).search, { redirect: "manual" });
  const page = new URL(response.headers.get("Location")!, "http://localhost:3000");
  expect(page.pathname).toBe("/reset-password");
  return page.searchParams.get("token")!;
}

test("a reset link sets a new password once and signs out every session", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const asked = await post("/api/auth/request-password-reset", {
    email: "ada@example.com",
    redirectTo: "/reset-password",
  });
  expect(asked.status).toBe(200);
  const token = await tokenOf((await resetMail("ada@example.com")).url);

  expect((await post("/api/auth/reset-password", { newPassword: "a-new-password", token })).status).toBe(200);
  expect((await signIn("password123")).ok).toBe(false);
  expect((await signIn("a-new-password")).ok).toBe(true);
  expect(await (await ada.fetch("/api/auth/get-session")).json()).toBeNull();

  const again = await post("/api/auth/reset-password", { newPassword: "another-password", token });
  expect(again.ok).toBe(false);
});

test("an unknown address gets the same answer, and no mail", async () => {
  t = await testServer();
  await t.signUp("ada");
  const unknown = await post("/api/auth/request-password-reset", { email: "nobody@example.com", redirectTo: "/" });
  const known = await post("/api/auth/request-password-reset", { email: "ada@example.com", redirectTo: "/" });
  expect([unknown.status, await unknown.json()]).toEqual([known.status, await known.json()]);
  await resetMail("ada@example.com");
  expect(t.mail.some((m) => m.to === "nobody@example.com")).toBe(false);
});

test("without mail, a production server refuses to reset, and says so to the app", async () => {
  const environment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    t = await testServer({ mailer: undefined });
  } finally {
    process.env.NODE_ENV = environment;
  }
  expect(await (await t.request("/api/config")).json()).toMatchObject({ mail: false });
  await t.signUp("ada");
  const asked = await post("/api/auth/request-password-reset", { email: "ada@example.com", redirectTo: "/" });
  expect(asked.ok).toBe(false);
});

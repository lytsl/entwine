import { afterEach, expect, test } from "bun:test";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
afterEach(() => t.cleanup());

const verificationTo = (to: string) => t.mailed((m) => m.to === to && m.subject === "Verify your email address");
const open = (account: Account, url: string) =>
  account.fetch(new URL(url).pathname + new URL(url).search, { redirect: "manual" });
const session = async (account: Account) =>
  ((await (await account.fetch("/api/auth/get-session")).json()) as { user: { email: string; emailVerified: boolean } })
    .user;

test("signing up mails a link that verifies the address, and it can be sent again", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const first = await verificationTo("ada@example.com");
  expect((await session(ada)).emailVerified).toBe(false);

  await ada.json("/api/auth/send-verification-email", { email: "ada@example.com", callbackURL: "/" });
  await t.mailed((m) => m.to === "ada@example.com" && m !== first && m.subject === "Verify your email address");

  expect((await open(ada, first.url)).status).toBe(302);
  expect((await session(ada)).emailVerified).toBe(true);
});

test("an unverified address changes at once, the new one is sent a link, and every workspace shows it", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "member"]]);
  await ada.json("/api/auth/change-email", { newEmail: "ada@new.example", callbackURL: "/" });
  expect((await session(ada)).email).toBe("ada@new.example");
  await verificationTo("ada@new.example");
  const directory = await bob.json<{ rows: { Member: { name: string; email: string }[] } }>(`/api/w/${id}/load`, {
    queries: [{ model: "Member" }],
  });
  expect(directory.rows.Member.find((m) => m.name === "ada")?.email).toBe("ada@new.example");
});

test("a verified address changes once the old address confirms and the new one verifies", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  await open(ada, (await verificationTo("ada@example.com")).url);

  await ada.json("/api/auth/change-email", { newEmail: "ada@new.example", callbackURL: "/" });
  const confirmation = await t.mailed(
    (m) => m.to === "ada@example.com" && m.subject === "Confirm your new email address",
  );
  expect(confirmation.text).toContain("to ada@new.example");
  expect((await session(ada)).email).toBe("ada@example.com");

  await open(ada, confirmation.url);
  expect((await session(ada)).email).toBe("ada@example.com");
  await open(ada, (await verificationTo("ada@new.example")).url);
  expect(await session(ada)).toMatchObject({ email: "ada@new.example", emailVerified: true });
});

test("an address another account uses is answered as any other, and neither account changes", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  await t.signUp("bob");
  const taken = await ada.fetch("/api/auth/change-email", {
    method: "POST",
    body: JSON.stringify({ newEmail: "bob@example.com", callbackURL: "/" }),
  });
  expect(taken.status).toBe(200);
  expect((await session(ada)).email).toBe("ada@example.com");
  // Bob's only mail is his own sign-up's.
  await verificationTo("bob@example.com");
  expect(t.mail.filter((m) => m.to === "bob@example.com")).toHaveLength(1);
});

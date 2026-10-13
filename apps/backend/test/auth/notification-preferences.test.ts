import { afterEach, expect, test } from "bun:test";
import type { NotificationPreferences } from "@entwine/shared";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
afterEach(() => t.cleanup());

const preferences = async (account: Account) =>
  ((await (await account.fetch("/api/auth/get-session")).json()) as { user: NotificationPreferences }).user;
const update = (account: Account, body: unknown) =>
  account.fetch("/api/auth/update-user", { method: "POST", body: JSON.stringify(body) });

test("an account's notification preferences start on, are saved, and refuse what is not a choice", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  expect(await preferences(ada)).toMatchObject({ emailNotifications: true, mutedNotifications: [] });

  expect((await update(ada, { emailNotifications: false, mutedNotifications: ["state", "commented"] })).status).toBe(
    200,
  );
  expect(await preferences(ada)).toMatchObject({
    emailNotifications: false,
    mutedNotifications: ["state", "commented"],
  });

  expect((await update(ada, { mutedNotifications: ["everything"] })).status).toBe(400);
  expect((await update(ada, { emailNotifications: "no" })).status).toBe(400);
  expect(await preferences(ada)).toMatchObject({
    emailNotifications: false,
    mutedNotifications: ["state", "commented"],
  });
});

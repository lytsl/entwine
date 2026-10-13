import { linkIn, mailCount, mailTo } from "../helpers/mail";
import { expect, signUp, test } from "../helpers/test";

test("a forgotten password is reset by the mailed link, which works once", async ({ browser, page }) => {
  const { email } = await signUp(browser, "Forgetful");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  const before = await mailCount();
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText(`If an account uses ${email}`);

  const link = linkIn(await mailTo(email, "Reset your entwine password", before), "/api/auth/reset-password/");
  await page.goto(link);
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  await page.getByLabel("New password", { exact: true }).fill("a-new-password");
  await page.getByLabel("Confirm new password").fill("a-new-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-new-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");

  await page.goto(link);
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
});

test("a new account is asked to verify its address until it opens the mailed link", async ({ browser }) => {
  const { page, email, slug } = await signUp(browser, "Unverified");
  const banner = page.getByText(`Verify ${email} to get notifications by mail`);
  await expect(banner).toBeVisible();
  const before = await mailCount();
  await page.getByRole("button", { name: "Send it again" }).click();
  const link = linkIn(await mailTo(email, "Verify your email address", before), "/api/auth/verify-email");
  await page.goto(link);
  await page.goto(`/${slug}`);
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  await expect(banner).toHaveCount(0);
});

test("an unverified address changes at once, and the new one is sent a link", async ({ browser }) => {
  const { page, slug } = await signUp(browser, "Mover");
  await page.goto(`/${slug}/settings/profile`);
  const newEmail = `moved-${crypto.randomUUID().slice(0, 8)}@example.com`;
  await page.getByRole("button", { name: "Change email" }).click();
  await page.getByRole("dialog", { name: "Change email" }).getByLabel("New email").fill(newEmail);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(`Your address is now ${newEmail}`)).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(newEmail);
  await mailTo(newEmail, "Verify your email address");
});

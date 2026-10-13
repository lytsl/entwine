import type { Page } from "@playwright/test";
import { expect, signUp, test } from "../helpers/test";

/** A 1×1 transparent PNG, which the app crops and sends on as its own picture. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** `owner` invites `member`'s account to its workspace, which `member` then joins. */
async function join(owner: Page, ownerSlug: string, member: { page: Page; email: string }) {
  const headers = { Origin: new URL(owner.url()).origin };
  const workspaces: { id: string; slug: string }[] = await (
    await owner.request.get("/api/auth/organization/list")
  ).json();
  const organizationId = workspaces.find((w) => w.slug === ownerSlug)!.id;
  const invitation = await (
    await owner.request.post("/api/auth/organization/invite-member", {
      headers,
      data: { email: member.email, role: "member", organizationId },
    })
  ).json();
  await member.page.request.post("/api/auth/organization/accept-invitation", {
    headers,
    data: { invitationId: invitation.id },
  });
}

test("an uploaded picture becomes the avatar, until it is removed", async ({ browser }) => {
  const { page, slug } = await signUp(browser, "Pictured");
  await page.goto(`/${slug}/settings/profile`);
  await page.getByLabel("Profile picture").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Profile picture updated")).toBeVisible();
  const picture = page.locator('img[src^="/api/avatars/"]').first();
  await expect(picture).toBeVisible();
  await page.goto(`/${slug}/settings/members`);
  await expect(page.getByRole("row").locator('img[src^="/api/avatars/"]')).toBeVisible();

  await page.goto(`/${slug}/settings/profile`);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Profile picture removed")).toBeVisible();
  await expect(page.locator('img[src^="/api/avatars/"]')).toHaveCount(0);
});

test("notification settings are saved as they are changed", async ({ browser }) => {
  const { page, email, slug } = await signUp(browser, "Notified");
  await page.goto(`/${slug}/settings/notifications`);
  const mail = page.getByRole("switch", { name: /^Email/ });
  await expect(mail).toBeDisabled();
  await expect(page.getByText(`Verify ${email} first`)).toBeVisible();

  const states = page.getByRole("switch", { name: /^State changes/ });
  await expect(states).toBeChecked();
  await states.click();
  await expect(page.getByText("Notification settings saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: /^State changes/ })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: /^Completions/ })).toBeChecked();
});

test("an owner hands a workspace on, and can then delete their account", async ({ browser }) => {
  const owner = await signUp(browser, "Founder");
  const heir = await signUp(browser, "Heir");
  await join(owner.page, owner.slug, heir);

  await owner.page.goto(`/${owner.slug}/settings/profile`);
  await owner.page.getByRole("button", { name: "Delete account" }).click();
  await owner.page.getByLabel("Your email").fill(owner.email);
  await owner.page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await expect(owner.page.getByText(/You are the only owner of/)).toBeVisible();
  await owner.page.keyboard.press("Escape");

  await owner.page.goto(`/${owner.slug}/settings/general`);
  await owner.page.getByRole("button", { name: "New owner" }).click();
  await owner.page.getByRole("option", { name: "Heir" }).click();
  await owner.page.getByRole("button", { name: "Transfer", exact: true }).click();
  await owner.page.getByRole("button", { name: "Transfer ownership" }).click();
  await expect(owner.page.getByText(`Heir is the owner of`)).toBeVisible();
  await owner.page.goto(`/${owner.slug}/settings/members`);
  await expect(owner.page.getByRole("row").filter({ hasText: "Heir" })).toContainText("Owner");
  await expect(owner.page.getByRole("row").filter({ hasText: "(you)" })).toContainText("Admin");

  await owner.page.goto(`/${owner.slug}/settings/profile`);
  await owner.page.getByRole("button", { name: "Delete account" }).click();
  await owner.page.getByLabel("Your email").fill(owner.email);
  await owner.page.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await expect(owner.page).toHaveURL(/\/login/);
  await owner.page.getByLabel("Email").fill(owner.email);
  await owner.page.getByLabel("Password").fill("password123");
  await owner.page.getByRole("button", { name: "Sign in" }).click();
  await expect(owner.page.getByText(/invalid/i)).toBeVisible();

  await heir.page.goto(`/${owner.slug}/settings/members`);
  await expect(heir.page.getByRole("row").filter({ hasText: "Founder" })).toHaveCount(0);
});

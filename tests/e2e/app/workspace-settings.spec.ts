import type { Page } from "@playwright/test";
import { heading, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

/** The stores this browser keeps: one per workspace the member has opened. */
const stores = (page: Page) =>
  page.evaluate(async () => {
    const root = (await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & {
      keys(): AsyncIterable<string>;
    };
    const names = new Set<string>();
    for await (const name of root.keys()) if (name.startsWith("entwine-")) names.add(name.slice(0, 24));
    return names.size;
  });

test("a workspace is renamed for every member, deleted by its owner, and its URL used again", async ({
  browser,
  baseURL,
}) => {
  test.slow();
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const headers = { Origin: baseURL as string };
  const suffix = crypto.randomUUID().slice(0, 8);
  const slug = `zeta-${suffix}`;
  /** Ada creates the workspace at `slug` and Bob joins it as a member. */
  const create = async (name: string) => {
    await ada.goto("/new");
    await ada.getByLabel("Name").fill(name);
    await ada.getByLabel("URL").fill(slug);
    await ada.getByRole("button", { name: "Create workspace" }).click();
    await expect(ada).toHaveURL(new RegExp(`/${slug}$`));
    await expect(ada.getByTestId("sync-status")).toHaveText("Live");
    const workspaces: { id: string; slug: string }[] = await (
      await ada.request.get("/api/auth/organization/list")
    ).json();
    const organizationId = workspaces.find((w) => w.slug === slug)?.id;
    const invitation = await (
      await ada.request.post("/api/auth/organization/invite-member", {
        headers,
        data: { email: "bob@example.com", role: "member", organizationId },
      })
    ).json();
    await bob.request.post("/api/auth/organization/accept-invitation", {
      headers,
      data: { invitationId: invitation.id },
    });
  };

  await create(`Zeta ${suffix}`);
  await bob.goto(`/${slug}/settings/labels`);
  await expect(bob.getByTestId("sync-status")).toHaveText("Live");
  const label = `Kept${suffix}`;
  await bob.getByRole("button", { name: "New label" }).click();
  await bob.getByLabel("New label").fill(label);
  await bob.getByRole("button", { name: "Create", exact: true }).click();
  await expect(bob.getByRole("list", { name: "Labels" }).getByRole("listitem", { name: label })).toBeVisible();
  expect(await stores(bob)).toBe(2);

  await sidebar(ada).getByRole("link", { name: "General" }).click();
  await expect(heading(ada)).toHaveText("General");
  await expect(ada.getByLabel("URL")).toHaveValue(new RegExp(`/${slug}$`));
  await expect(ada.getByLabel("URL")).toHaveAttribute("readonly", "");
  await expect(ada.getByRole("button", { name: "Save changes" })).toBeDisabled();
  // Surrounding spaces are no change.
  await ada.getByLabel("Name", { exact: true }).fill(` Zeta ${suffix} `);
  await expect(ada.getByRole("button", { name: "Save changes" })).toBeDisabled();
  const renamed = `Renamed ${suffix}`;
  await ada.getByLabel("Name", { exact: true }).fill(renamed);
  await ada.getByRole("button", { name: "Save changes" }).click();
  for (const page of [ada, bob]) await expect(sidebar(page).getByRole("button", { name: renamed })).toBeVisible();
  await expect(ada).toHaveURL(new RegExp(`/${slug}/settings/general$`));

  await bob.setViewportSize({ width: 320, height: 700 });
  await bob.goto(`/${slug}/settings/general`);
  await expect(bob.getByLabel("Name", { exact: true })).toHaveValue(renamed);
  await expect(bob.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(bob.getByText("Only owners and admins can rename the workspace.")).toBeVisible();
  await expect(bob.getByRole("button", { name: "Delete workspace" })).toHaveCount(0);
  expect(await bob.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  await bob.setViewportSize({ width: 1280, height: 720 });

  await ada.getByRole("button", { name: "Delete workspace" }).click();
  const dialog = ada.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Delete workspace" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Workspace name").fill(`Zeta ${suffix}`);
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Workspace name").fill(renamed);
  await expect(confirm).toBeEnabled();
  await dialog.getByLabel("Workspace name").press("Enter");
  await expect(ada.getByText(`${renamed} was deleted`)).toBeVisible();
  await expect(bob.getByText(`You no longer belong to ${renamed}.`)).toBeVisible();
  for (const page of [ada, bob]) {
    await expect(page).toHaveURL(/\/acme$/);
    await expect(page.getByTestId("sync-status")).toHaveText("Live");
    await page.getByRole("button", { name: "Acme", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: renamed })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await expect.poll(() => stores(bob)).toBe(1);
  await bob.goto(`/${slug}`);
  await expect(bob.getByText("This workspace does not exist, or you are not a member of it.")).toBeVisible();

  // The same URL now names a new workspace, which shows nothing of the old one in the browser that had it.
  await create(`Zeta again ${suffix}`);
  await bob.goto(`/${slug}/settings/labels`);
  await expect(bob.getByTestId("sync-status")).toHaveText("Live");
  await expect(sidebar(bob).getByRole("button", { name: `Zeta again ${suffix}` })).toBeVisible();
  await expect(bob.getByText("No labels yet")).toBeVisible();
  await expect(bob.getByText(label)).toHaveCount(0);
});

test("a member changes their name, which others see at once, and their password, which ends other sessions", async ({
  browser,
  baseURL,
}) => {
  // The other session ends at the stream's next heartbeat.
  test.slow();
  const ada = await signIn(browser, "ada");
  await sidebar(ada).getByRole("link", { name: "Members" }).click();
  const headers = { Origin: baseURL as string };
  const [{ id: organizationId }] = await (await ada.request.get("/api/auth/organization/list")).json();
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `profile-${suffix}@example.com`;
  const context = await browser.newContext();
  const elsewhere = await browser.newContext();
  try {
    await context.request.post("/api/auth/sign-up/email", {
      headers,
      data: { name: `Before ${suffix}`, email, password: "password123" },
    });
    const invitation = await (
      await ada.request.post("/api/auth/organization/invite-member", {
        headers,
        data: { email, role: "member", organizationId },
      })
    ).json();
    await context.request.post("/api/auth/organization/accept-invitation", {
      headers,
      data: { invitationId: invitation.id },
    });
    await elsewhere.request.post("/api/auth/sign-in/email", { headers, data: { email, password: "password123" } });
    const other = await elsewhere.newPage();
    await other.goto("/acme");
    await expect(other.getByTestId("sync-status")).toHaveText("Live");

    const page = await context.newPage();
    await page.goto("/acme");
    await expect(page.getByTestId("sync-status")).toHaveText("Live");
    await page.getByRole("button", { name: "Acme", exact: true }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await expect(heading(page)).toHaveText("Profile");
    await expect(page.getByLabel("Email")).toHaveValue(email);
    await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");

    await expect(ada.getByRole("row").filter({ hasText: email })).toContainText(`Before ${suffix}`);
    await page.getByLabel("Name").fill(`After ${suffix}`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    await expect(ada.getByRole("row").filter({ hasText: email })).toContainText(`After ${suffix}`);
    await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();

    // The toast of the form above is still up, and does not lie over this form's button.
    await expect(page.getByText("Profile saved")).toBeVisible();
    const change = page.getByRole("button", { name: "Change password" });
    await page.getByLabel("Current password").fill("password123");
    await page.getByLabel("New password", { exact: true }).fill("another-password");
    await page.getByLabel("Confirm new password").fill("another-pasword");
    await change.click();
    await expect(page.getByLabel("Confirm new password")).toHaveAccessibleDescription("The passwords do not match");
    await page.getByLabel("Confirm new password").fill("another-password");
    await page.getByLabel("Current password").fill("not-the-password");
    await change.click();
    await expect(page.getByText("The current password is wrong")).toBeVisible();
    await page.getByLabel("Current password").fill("password123");
    await change.click();
    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByLabel("Current password")).toHaveValue("");

    await page.reload();
    await expect(heading(page)).toHaveText("Profile");
    await expect(other).toHaveURL(/\/login/, { timeout: 40_000 });
    await other.getByLabel("Email").fill(email);
    await other.getByLabel("Password").fill("another-password");
    await other.getByRole("button", { name: "Sign in" }).click();
    await expect(other.getByTestId("sync-status")).toHaveText("Live");
  } finally {
    await Promise.allSettled([context.close(), elsewhere.close()]);
  }
});

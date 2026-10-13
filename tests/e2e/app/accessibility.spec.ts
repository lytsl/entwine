import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createAndOpen, heading, layout, newProject, peek, row, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

/** What axe finds against WCAG 2.2 A and AA, as `rule: element` lines. */
async function violations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.flatMap((v) => v.nodes.map((node) => `${v.id}: ${node.target.join(" ")}`));
}

/** A signed-in page that asks for no motion: axe reads a colour halfway through a fade as the colour. */
async function still(page: Page, theme: "dark" | "light") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate((theme) => localStorage.setItem("entwine:theme", theme), theme);
  await page.reload();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
}

for (const theme of ["dark", "light"] as const) {
  test(`the layouts, an issue and the settings pass axe on the ${theme} theme`, async ({ browser }) => {
    test.slow();
    const page = await signIn(browser, "ada");
    await still(page, theme);
    const project = await newProject(page, "Axe");
    const title = `Readable ${Date.now()}`;
    await createAndOpen(page, title);
    expect(await violations(page)).toEqual([]);
    await page.getByRole("button", { name: "Add reaction" }).click();
    expect(await violations(page), "reaction menu").toEqual([]);
    await page.getByRole("menuitem", { name: "👍" }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByRole("list", { name: "Attachments" })).toBeVisible();
    expect(await violations(page), "reactions and attachments").toEqual([]);

    await sidebar(page).getByRole("link", { name: project.name, exact: true }).click();
    await expect(heading(page)).toHaveText("Issues");
    for (const name of ["List", "Board", "Spreadsheet", "Calendar", "Timeline"] as const) {
      await layout(page, name);
      expect(await violations(page), name).toEqual([]);
    }
    await layout(page, "List");
    await peek(page, title);
    expect(await violations(page), "peek").toEqual([]);
    await page.getByRole("button", { name: "Close preview" }).click();

    await page.keyboard.press("c");
    await page.getByRole("button", { name: "Create issue" }).click();
    await expect(page.getByLabel("Title")).toHaveAccessibleDescription("A title is required");
    expect(await violations(page), "new issue").toEqual([]);
    await page.keyboard.press("Escape");

    for (const name of ["Cycles", "Modules", "Settings"]) {
      await sidebar(page).getByRole("link", { name, exact: true }).click();
      await expect(heading(page)).toHaveText(name);
      expect(await violations(page), name).toEqual([]);
    }
    for (const name of ["General", "Members", "Labels", "Projects", "Views", "Inbox"]) {
      await sidebar(page).getByRole("link", { name, exact: true }).click();
      await expect(heading(page)).toHaveText(name);
      expect(await violations(page), name).toEqual([]);
    }
    await sidebar(page).getByRole("link", { name: "General", exact: true }).click();
    await page.getByRole("button", { name: "Delete workspace" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await violations(page), "delete workspace").toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Acme", exact: true }).click();
    await page.getByRole("menuitem", { name: "Profile" }).click();
    await expect(heading(page)).toHaveText("Profile");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByLabel("Current password")).toHaveAccessibleDescription("Required");
    expect(await violations(page), "Profile").toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Acme", exact: true }).click();
    await page.getByRole("menuitem", { name: "Notifications" }).click();
    await expect(heading(page)).toHaveText("Notifications");
    expect(await violations(page), "Notifications").toEqual([]);
  });
}

test("the sign-in page passes axe, and says which field is wrong", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("Email")).toHaveAccessibleDescription("Enter an email address");
  expect(await violations(page)).toEqual([]);

  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByLabel("Email")).toHaveAccessibleDescription("Enter an email address");
  expect(await violations(page), "forgot password").toEqual([]);
  await page.goto("/reset-password?token=unused");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByLabel("New password", { exact: true })).not.toHaveAccessibleDescription("");
  expect(await violations(page), "reset password").toEqual([]);
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  expect(await violations(page), "expired link").toEqual([]);
  await context.close();
});

test("a phone-wide page keeps the issue, its dialog and the members readable", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  const project = await newProject(page, "Narrow");
  const title = `A title long enough to wrap on a phone ${Date.now()}`;
  await createAndOpen(page, title);
  await page.setViewportSize({ width: 320, height: 640 });

  await expect.poll(async () => (await page.getByLabel("Title").boundingBox())?.width ?? 0).toBeGreaterThan(240);
  await expect(page.getByRole("region", { name: "Properties" })).toBeVisible();
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(await fits()).toBe(true);

  await page.keyboard.press("c");
  await expect(page.getByRole("button", { name: "Create issue" })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Assignee: Unassigned" })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");

  // The calendar has no room for titles: a day is its number, and tapping it lists what is due.
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await sidebar(page).getByRole("link", { name: project.name, exact: true }).click();
  await layout(page, "Calendar");
  const day = page.getByRole("button", { name: /^\w+, \w+ 15, 0 issues$/ });
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: /^Issues due \w+, \w+ 15$/ })).toContainText(
    "Nothing is due this day.",
  );
  expect(await fits()).toBe(true);
  expect(await violations(page), "narrow calendar").toEqual([]);

  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await sidebar(page).getByRole("link", { name: "Members", exact: true }).click();
  const ada = page.getByRole("row").filter({ hasText: "ada@example.com" });
  await expect(ada.getByText("Ada", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(ada.getByText("ada@example.com")).toBeInViewport({ ratio: 1 });
  expect(await fits()).toBe(true);
});

test("the keyboard skips the sidebar, and a closed dialog gives focus back", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  await newProject(page, "Keys");
  const title = `Focus ${Date.now()}`;
  await page.keyboard.press("c");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(row(page, title)).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  const opener = page.getByRole("main").getByRole("button", { name: "New issue", exact: true }).first();
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});

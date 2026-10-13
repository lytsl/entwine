import { heading, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("sign up, create a workspace, sign out and back in", async ({ page }) => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `new-${suffix}@example.com`;
  const name = `Newco Labs ${suffix}`;
  const slug = `newco-labs-${suffix}`;
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("link", { name: "Sign up" }).click();
  await page.getByLabel("Name").fill("Newcomer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(/\/new/);
  await expect(page.getByLabel("URL")).toBeVisible();
  await page.getByLabel("Name").fill(name);
  await expect(page.getByLabel("URL")).toHaveValue(slug);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}$`));
  await expect(page.getByTestId("sync-status")).toHaveText("Live");

  await page.getByRole("button", { name }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}$`));
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid/i)).toBeVisible();
});

test("unknown addresses offer a way back", async ({ browser, page: signedOut }) => {
  const page = await signIn(browser, "ada");
  const notFoundWarnings: string[] = [];
  for (const current of [page, signedOut]) {
    current.on("console", (message) => {
      if (message.type() === "warning" && message.text().includes("notFoundComponent")) {
        notFoundWarnings.push(message.text());
      }
    });
  }

  await page.goto("/acme/nothing/here");
  await expect(page).toHaveURL(/\/acme\/nothing\/here$/);
  await expect(sidebar(page)).toBeVisible();
  await expect(heading(page)).toHaveText("Page not found");
  await expect(page.getByText("This page does not exist.")).toBeVisible();
  const myIssues = page.getByRole("link", { name: "Back to my issues" });
  await expect(myIssues).toHaveAttribute("href", "/acme");
  await myIssues.click();
  await expect(page).toHaveURL(/\/acme$/);
  await expect(heading(page)).toHaveText("My issues");

  for (const current of [page, signedOut]) {
    await current.goto("/login/extra");
    await expect(current).toHaveURL((url) => url.pathname === "/login/extra");
    await expect(current.getByText("This page does not exist.")).toBeVisible();
    await expect(sidebar(current)).toHaveCount(0);
    const workspaces = current.getByRole("link", { name: "Go to your workspaces" });
    await expect(workspaces).toHaveAttribute("href", "/");
    await workspaces.click();
    await expect(current).toHaveURL(current === page ? /\/acme$/ : /\/login/);
  }

  await page.goto(`/unknown-${crypto.randomUUID()}`);
  await expect(page.getByText("This workspace does not exist, or you are not a member of it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to your workspaces" })).toHaveAttribute("href", "/");
  expect(notFoundWarnings).toEqual([]);
});

import { type Browser, type BrowserContext, test as base, expect, type Page } from "@playwright/test";

export { expect };

const contexts = new Set<BrowserContext>();

/**
 * Closes the contexts `signIn` opened when each test ends: every open page keeps a sync stream and a SQLite worker,
 * which would slow down the tests after it.
 */
export const test = base.extend<{ closeContexts: void }>({
  closeContexts: [
    async ({}, use) => {
      await use();
      await Promise.all([...contexts].map((context) => context.close()));
      contexts.clear();
    },
    { auto: true },
  ],
});

export async function signIn(browser: Browser, name: "ada" | "bob" | "cy"): Promise<Page> {
  const context = await browser.newContext();
  contexts.add(context);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(`${name}@example.com`);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  return page;
}

/**
 * A new account, signed in, with a workspace of its own open: for a test that changes an account, which the seeded
 * ones are shared too widely to bear.
 */
export async function signUp(browser: Browser, name: string): Promise<{ page: Page; email: string; slug: string }> {
  const context = await browser.newContext();
  contexts.add(context);
  const page = await context.newPage();
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `${name.toLowerCase()}-${suffix}@example.com`;
  const slug = `${name.toLowerCase()}-${suffix}`;
  await page.goto("/login");
  // The server refuses account requests from any origin but the app's.
  const headers = { Origin: new URL(page.url()).origin };
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", { headers, data: { name, email, password: "password123" } })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/auth/organization/create", { headers, data: { name: `${name} ${suffix}`, slug } })
    ).ok(),
  ).toBe(true);
  await page.goto(`/${slug}`);
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  return { page, email, slug };
}

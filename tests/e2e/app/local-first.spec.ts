import type { Request } from "@playwright/test";
import { choose, createAndOpen, createIssue, heading, newProject, openProject, row, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

/** A load of the whole workspace, as a first visit or a rebuild makes it. */
const isBootstrap = (request: Request) =>
  request.url().endsWith("/load") && (request.postData() ?? "").includes('{"model":"Member"}');

test("concurrent creates use the server's final issue numbers when a send is delayed", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Numbers");
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
  await openProject(bob, project.name);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let accept!: () => void;
  const sent = new Promise<void>((resolve) => {
    accept = resolve;
  });
  await ada.route("**/transactions", async (route) => {
    accept();
    await held;
    await route.continue();
  });
  const title = `Delayed ${crypto.randomUUID()}`;
  const key = createAndOpen(ada, title);
  // Attach immediately so a failed navigation is reported even while the other member is writing.
  void key.catch(() => {});
  try {
    await expect(ada).toHaveURL(/\/issues\/[\w-]+$/);
    await expect(ada.getByRole("complementary", { name: "Issue preview" })).toHaveCount(0);
    await expect(ada.getByLabel("Title", { exact: true })).toHaveValue(title);
    await sent;
    const other = `First ${crypto.randomUUID()}`;
    const saved = bob.waitForResponse((response) => response.url().endsWith("/transactions"));
    await createIssue(bob, other);
    expect((await saved).ok()).toBe(true);
    await expect(row(bob, other)).toContainText(`${project.identifier}-1`);
    release();
    expect(await key).toBe(`${project.identifier}-2`);
    await expect(row(bob, title)).toContainText(`${project.identifier}-2`);
  } finally {
    release();
    await key.catch(() => {});
  }
});

test("a reload shows the workspace from this browser, without loading it from the server again", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await expect(row(ada, "Redesign the landing page")).toBeVisible();
  const bootstraps: string[] = [];
  ada.on("request", (request) => {
    if (isBootstrap(request)) bootstraps.push(request.url());
  });
  // The first visit is stored in the background; a reload before it is done loads from the server again.
  await expect(async () => {
    bootstraps.length = 0;
    await ada.reload();
    await expect(row(ada, "Redesign the landing page")).toBeVisible();
    await expect(ada.getByTestId("sync-status")).toHaveText("Live");
    expect(bootstraps).toEqual([]);
  }).toPass({ intervals: [1000, 2000, 4000] });
});

test("an edit made offline stays shown, waits, and is saved once the browser is back online", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Offline");
  const title = `Offline ${Date.now()}`;
  await createIssue(ada, title);
  await openProject(bob, project.name);
  await expect(row(bob, title)).toBeVisible();

  await ada.context().setOffline(true);
  await expect(ada.getByTestId("sync-status")).toHaveText("Offline");
  await choose(ada, row(ada, title).getByLabel("Priority: No priority"), "High");
  await expect(row(ada, title).getByLabel("Priority: High")).toBeVisible();
  await expect(ada.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");

  await ada.context().setOffline(false);
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
  await expect(row(bob, title).getByLabel("Priority: High")).toBeVisible();
  await expect(row(ada, title).getByLabel("Priority: High")).toBeVisible();
});

test("an open tab still moves between its pages after minutes offline", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Away");
  const title = `Away ${Date.now()}`;
  await createIssue(ada, title);
  await ada.clock.install();

  await ada.context().setOffline(true);
  await expect(ada.getByTestId("sync-status")).toHaveText("Offline");
  // Longer than any answer about who is signed in is taken as fresh.
  await ada.clock.fastForward("05:00");
  await sidebar(ada).getByRole("link", { name: "My issues", exact: true }).click();
  await expect(heading(ada)).toHaveText("My issues");
  await openProject(ada, project.name);
  await expect(row(ada, title)).toBeVisible();

  await ada.context().setOffline(false);
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
});

test("a page loaded while the server cannot be reached offers to try again and keeps the member signed in", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  // The pages still load, as from a host of static files; nothing behind the API answers.
  await ada.route("**/api/**", (route) => route.abort());
  await ada.reload();
  await expect(ada.getByRole("alert")).toContainText("Something went wrong");

  await ada.unroute("**/api/**");
  await ada.getByRole("button", { name: "Try again" }).click();
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
});

test("Ctrl+Z undoes a state change for everyone, and Ctrl+Shift+Z redoes it", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Undo");
  const title = `Undo ${Date.now()}`;
  await createIssue(ada, title);
  await openProject(bob, project.name);

  await choose(ada, row(ada, title).getByLabel("State: Backlog"), "In Progress");
  await expect(row(bob, title).getByLabel("State: In Progress")).toBeVisible();

  await ada.keyboard.press("ControlOrMeta+z");
  await expect(row(ada, title).getByLabel("State: Backlog")).toBeVisible();
  await expect(row(bob, title).getByLabel("State: Backlog")).toBeVisible();

  await ada.keyboard.press("ControlOrMeta+Shift+z");
  await expect(row(ada, title).getByLabel("State: In Progress")).toBeVisible();
  await expect(row(bob, title).getByLabel("State: In Progress")).toBeVisible();
});

test("a second tab opens from this browser, and an edit it could not send is sent after it closes", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Shared");
  const title = `Shared ${Date.now()}`;
  await createIssue(ada, title);
  await openProject(bob, project.name);
  await expect(row(bob, title).getByLabel("Priority: No priority")).toBeVisible();
  const second = await ada.context().newPage();
  const bootstraps: string[] = [];
  second.on("request", (request) => {
    if (isBootstrap(request)) bootstraps.push(request.url());
  });
  await second.goto(ada.url());
  await expect(row(second, title)).toBeVisible();
  expect(bootstraps).toEqual([]);
  await ada.context().setOffline(true);
  await choose(second, row(second, title).getByLabel("Priority: No priority"), "High");
  await expect(second.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");
  await expect(row(bob, title).getByLabel("Priority: No priority")).toBeVisible();
  await second.close();
  await ada.context().setOffline(false);
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
  // The browser may take several seconds to free a closed tab's lock, and its edit is only taken over then.
  await expect(row(ada, title).getByLabel("Priority: High")).toBeVisible({ timeout: 20_000 });
  await expect(row(bob, title).getByLabel("Priority: High")).toBeVisible();
  await ada.reload();
  await expect(row(ada, title).getByLabel("Priority: High")).toBeVisible();
});

test("undoing an issue delete restores its original number", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Restore");
  const title = `Restore ${Date.now()}`;
  await createIssue(ada, title);
  const original = (await row(ada, title).textContent())!;
  await openProject(bob, project.name);
  await expect(row(bob, title)).toBeVisible();
  await row(ada, title)
    .getByRole("button", { name: /actions$/ })
    .click();
  await ada.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await ada.getByRole("button", { name: "Delete issue", exact: true }).click();
  await expect(row(ada, title)).toHaveCount(0);
  await expect(row(bob, title)).toHaveCount(0);
  await ada.keyboard.press("ControlOrMeta+z");
  await expect(row(ada, title)).toBeVisible();
  await expect(row(ada, title)).toHaveText(original);
  await expect(row(bob, title)).toHaveText(original);
  await ada.reload();
  await expect(row(ada, title)).toHaveText(original);
});

test("without Web Locks the memory client keeps offline edits until reconnect and reloads from the server", async ({
  browser,
  page,
}) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  const project = await newProject(page, "Memory");
  const title = `Memory ${crypto.randomUUID()}`;
  await createIssue(page, title);
  const bob = await signIn(browser, "bob");
  await openProject(bob, project.name);
  await expect(row(bob, title)).toBeVisible();
  await page.context().setOffline(true);
  await choose(page, row(page, title).getByLabel("Priority: No priority"), "High");
  await expect(row(page, title).getByLabel("Priority: High")).toBeVisible();
  await expect(page.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");
  await expect(row(bob, title).getByLabel("Priority: No priority")).toBeVisible();
  await page.context().setOffline(false);
  await expect(row(bob, title).getByLabel("Priority: High")).toBeVisible();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  const bootstrap = page.waitForRequest(isBootstrap);
  await page.reload();
  await bootstrap;
  await expect(row(page, title).getByLabel("Priority: High")).toBeVisible();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
});

test("a workspace the server cannot load says so, keeps trying, and opens when asked again", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  // A browser that holds nothing of the workspace, signed in as the same member.
  const context = await browser.newContext({ storageState: await ada.context().storageState() });
  const page = await context.newPage();
  let broken = true;
  await page.route("**/api/w/*/load", (route) =>
    broken
      ? route.fulfill({ status: 500, json: { error: "The workspace is busy", code: "failed" } })
      : route.continue(),
  );
  await page.goto(new URL(ada.url()).pathname);
  const failed = page.getByRole("alert").filter({ hasText: "The workspace is busy" });
  await expect(failed).toBeVisible({ timeout: 15_000 });
  broken = false;
  await failed.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  await context.close();
});

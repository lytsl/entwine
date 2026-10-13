import { writeFile } from "node:fs/promises";
import { heading, layout, newProject, openProject, peek, row, search, sidebar } from "../helpers/page";
import { expect, signIn, signUp, test } from "../helpers/test";

test("sign-out releases live queries without browser errors", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Live Query")) errors.push(message.text());
  });
  await sidebar(page).getByRole("button", { name: "Acme", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  expect(errors).toEqual([]);
});

test("a narrow timeline leaves at least half the view for scheduling", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  await openProject(page, "Website");
  await page.setViewportSize({ width: 390, height: 844 });
  await layout(page, "Timeline");
  await expect(page.getByTestId("timeline-track").first()).toBeVisible();
  const issueColumn = await page.getByTestId("timeline-row").first().locator(":scope > div").first().boundingBox();
  expect(issueColumn!.width).toBeLessThanOrEqual(390 / 2);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByTestId("timeline-bar").first()).toBeInViewport();
});

test("mobile navigation closes after choosing a workspace page", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await sidebar(page).getByRole("link", { name: "Projects", exact: true }).click();
  await expect(heading(page)).toHaveText("Projects");
  await expect(page.getByRole("dialog", { name: "Sidebar" })).toHaveCount(0);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "New project" })).toBeVisible();
});

test("forms remain reachable on a short viewport with a long description", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  await openProject(page, "Website");
  await page.setViewportSize({ width: 640, height: 360 });
  await page.locator("header").getByRole("button", { name: "New issue", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New issue" });
  const title = `Long description ${crypto.randomUUID()}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Description").fill(Array.from({ length: 50 }, (_, i) => `Paragraph ${i}`).join("\n\n"));
  await expect(async () => {
    const box = await dialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(360);
  }).toPass({ timeout: 2000 });
  await dialog.getByRole("button", { name: /^Create issue/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row(page, title)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 360 });
  await sidebar(page).getByRole("button", { name: "New project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "New project" });
  await expect(async () => {
    const box = await projectDialog.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(360);
  }).toPass({ timeout: 2000 });
  await projectDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(projectDialog).toHaveCount(0);
});

test("an invite survives signup, joins the workspace and enforces changed membership", async ({ browser, page }) => {
  const owner = await signIn(browser, "ada");
  const email = `audit-${crypto.randomUUID()}@example.com`;
  const name = `Guest ${crypto.randomUUID().slice(0, 8)}`;
  await sidebar(owner).getByRole("link", { name: "Members" }).click();
  await owner.getByRole("button", { name: "Invite people" }).click();
  await owner.getByLabel("Email to invite").fill(email);
  const response = owner.waitForResponse((response) => response.url().endsWith("/organization/invite-member"));
  await owner.getByRole("button", { name: "Invite", exact: true }).click();
  const invitation = await (await response).json();
  await page.goto(`/invite/${invitation.id}`);
  await expect(page).toHaveURL(/\/signup/);
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  await expect(page).toHaveURL(/\/acme$/);
  await sidebar(page).getByRole("link", { name: "Members" }).click();
  await expect(page.getByRole("button", { name: "Invite people" })).toHaveCount(0);
  await owner.getByRole("button", { name: `Role of ${name}: member`, exact: true }).click();
  await owner.getByRole("option", { name: "Admin", exact: true }).click();
  await expect(page.getByRole("button", { name: "Invite people" })).toBeVisible();
  await owner.getByRole("button", { name: `Remove ${name}`, exact: true }).click();
  await owner.getByRole("dialog").getByRole("button", { name: "Remove member" }).click();
  await expect(page.getByText("You no longer belong to Acme.")).toBeVisible({ timeout: 35_000 });
});

test("an invite to an existing account opens sign-in with its address", async ({ browser, page, baseURL }) => {
  const owner = await signIn(browser, "ada");
  const { email } = await signUp(browser, "Invitee");
  const [{ id: organizationId }] = await (await owner.request.get("/api/auth/organization/list")).json();
  const invitation = await (
    await owner.request.post("/api/auth/organization/invite-member", {
      headers: { Origin: baseURL as string },
      data: { email, role: "member", organizationId },
    })
  ).json();
  await page.goto(`/invite/${invitation.id}`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toBeVisible();
});
test("a thousand issues stay virtualized and searchable in Chromium", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const page = await signIn(browser, "ada");
  const suffix = crypto.randomUUID().slice(0, 8);
  await page.goto("/new");
  await page.getByLabel("Name").fill(`Performance ${suffix}`);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  await newProject(page, "Scale");
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;
  const organizations = await (await page.request.get("/api/auth/organization/list")).json();
  const workspaceId = organizations.find(
    (workspace: { slug: string }) => workspace.slug === `performance-${suffix}`,
  ).id;
  const session = await (await page.request.get("/api/auth/get-session")).json();
  const now = Date.now();
  for (let start = 0; start < 1000; start += 200) {
    const mutations = Array.from({ length: 200 }, (_, index) => {
      const id = crypto.randomUUID();
      return {
        model: "Issue",
        type: "insert",
        key: id,
        value: {
          id,
          projectId,
          number: start + index + 1,
          title: `Scale issue ${start + index + 1}`,
          description: "",
          stateId: `${projectId}:backlog`,
          priority: "none",
          assigneeId: null,
          creatorId: session.user.id,
          parentId: null,
          startDate: null,
          dueDate: null,
          estimate: null,
          cycleId: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      };
    });
    const result = await page.request.post(`/api/w/${workspaceId}/transactions`, {
      data: { id: crypto.randomUUID(), mutations },
    });
    expect(result.ok()).toBe(true);
  }
  await expect(page.getByTitle("1000 issues")).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const measurements: unknown[] = [];
  for (const name of ["List", "Board", "Spreadsheet"] as const) {
    const before = performance.now();
    await layout(page, name);
    const rendered =
      name === "Spreadsheet"
        ? page.getByRole("table", { name: "Issues" }).getByRole("row")
        : page.getByTestId(name === "List" ? "issue-row" : "issue-card");
    await expect(rendered.first()).toBeVisible();
    expect(await rendered.count()).toBeLessThan(100);
    await search(page, "Scale issue 1000");
    await expect(page.getByTitle("1 issue")).toBeVisible();
    await expect(page.getByRole("link", { name: "Scale issue 1000", exact: true })).toBeVisible();
    measurements.push({
      layout: name,
      layoutAndSearchMs: Math.round(performance.now() - before),
      metrics: (await cdp.send("Performance.getMetrics")).metrics,
    });
    await page.getByLabel("Search issues").press("Escape");
    await expect(page.getByTitle("1000 issues")).toBeVisible();
  }
  const path = testInfo.outputPath("chromium-performance.json");
  await writeFile(path, JSON.stringify(measurements, null, 2));
  await testInfo.attach("chromium-performance.json", { path, contentType: "application/json" });
});

test("issue view actions remain inside a narrow viewport", async ({ browser }, testInfo) => {
  const page = await signIn(browser, "ada");
  await openProject(page, "Website");
  const title = "Fix broken footer links";
  for (const width of [390, 800, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(heading(page)).toHaveText("Issues");
    await page.screenshot({ path: testInfo.outputPath(`issues-${width}.png`) });
    for (const name of ["Filters", "Display", "New issue"]) {
      const button = page.locator("header").getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      await expect(async () => {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }).toPass();
    }
    const link = row(page, title).getByRole("link", { name: title, exact: true });
    expect((await link.boundingBox())!.width).toBeGreaterThan(150);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const panel = await peek(page, title);
  await expect(panel.getByLabel("Title")).toBeVisible();
  await panel.getByRole("button", { name: "Close preview" }).click();
  await layout(page, "Board");
  await page.screenshot({ path: testInfo.outputPath("mobile-board.png") });
  for (const name of ["Spreadsheet", "Calendar", "Timeline"] as const) {
    await layout(page, name);
    await page.screenshot({ path: testInfo.outputPath(`mobile-${name.toLowerCase()}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    if (name === "Calendar") {
      for (const action of ["Previous month", "Next month", "Today"]) {
        await expect(page.getByRole("button", { name: action, exact: true })).toBeInViewport();
      }
      // A phone's month has no room for titles: the issues of the day that is tapped are listed under it.
      const due = page.getByRole("button", { name: /, [1-9]\d* issues?$/ });
      if (!(await due.count())) await page.getByRole("button", { name: "Next month", exact: true }).click();
      await due.first().click();
      const cards = page.getByTestId("calendar-issue");
      await expect(cards.first()).toBeVisible();
      for (const card of await cards.all()) {
        expect(await card.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
          await card.evaluate((element) => element.clientWidth),
        );
      }
      const title = (await cards.first().getByRole("link").textContent())!;
      await cards.first().getByRole("link").click();
      const preview = page.getByRole("complementary", { name: "Issue preview" });
      await expect(preview.getByLabel("Title", { exact: true })).toHaveValue(title);
      await preview.getByRole("button", { name: "Close preview", exact: true }).click();
    }
  }
});

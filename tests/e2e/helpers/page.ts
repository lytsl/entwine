import { expect, type Locator, type Page } from "@playwright/test";

export const sidebar = (page: Page): Locator => page.getByRole("navigation", { name: "Workspace" });

export const heading = (page: Page): Locator =>
  page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("heading", { level: 1 });

export async function openProject(page: Page, name: string) {
  await sidebar(page).getByRole("link", { name, exact: true }).click();
  await expect(heading(page)).toHaveText("Issues");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(name);
}

/** The name and identifier are unique; the app opens the new project. */
export async function newProject(page: Page, prefix: string): Promise<{ name: string; identifier: string }> {
  const suffix = Date.now().toString(36).slice(-4).toUpperCase();
  const project = { name: `${prefix} ${suffix}`, identifier: `${prefix[0].toUpperCase()}${suffix}` };
  await sidebar(page).getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name").fill(project.name);
  await page.getByLabel("Identifier").fill(project.identifier);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(heading(page)).toHaveText("Issues");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(project.name);
  return project;
}

/** Creates in the project on screen; the page stays where it was. */
export async function createIssue(page: Page, title: string) {
  await page.keyboard.press("c");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByRole("dialog", { name: "New issue" })).toHaveCount(0);
}

export async function openPage(page: Page, name: "Cycles" | "Modules" | "Settings") {
  await sidebar(page).getByRole("link", { name, exact: true }).click();
  await expect(heading(page)).toHaveText(name);
}

export async function newPlan(page: Page, kind: "cycle" | "module", name: string) {
  await page
    .getByRole("button", { name: `New ${kind}` })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: `New ${kind}` });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: `Create ${kind}` }).click();
  await expect(dialog).toHaveCount(0);
}

export const progress = (page: Page): Locator => page.getByRole("region", { name: "Progress", exact: true });

export const description = (page: Page): Locator => page.getByLabel("Description");

/** Leaves the editor, which saves a description. */
export const blur = (page: Page) => heading(page).click();

export const paste = (editor: Locator, text: string) =>
  editor.evaluate((element, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", value);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
  }, text);

export const row = (page: Page, title: string): Locator => page.getByTestId("issue-row").filter({ hasText: title });

/**
 * A view renders only the rows near its viewport, and other specs add issues to the shared workspace: searching
 * brings an issue of a view that spans projects into them.
 */
export async function search(page: Page, text: string) {
  await page.keyboard.press("/");
  await page.getByLabel("Search issues").fill(text);
}

export async function peek(page: Page, title: string): Promise<Locator> {
  await row(page, title).getByRole("link", { name: title }).click();
  const panel = page.getByRole("complementary", { name: "Issue preview" });
  await expect(panel.getByLabel("Title")).toHaveValue(title);
  return panel;
}

export async function createAndOpen(page: Page, title: string): Promise<string> {
  const saved = page.waitForResponse((response) => {
    if (!response.url().endsWith("/transactions")) return false;
    const body = response.request().postDataJSON();
    return body.mutations?.some(
      (mutation: { model: string; type: string; value: { title?: string } }) =>
        mutation.model === "Issue" && mutation.type === "insert" && mutation.value.title === title,
    );
  });
  void saved.catch(() => {});
  await createIssue(page, title);
  const panel = await peek(page, title);
  await panel.getByRole("link", { name: "Open issue page" }).click();
  await expect(page).toHaveURL(/\/issues\/[\w-]+$/);
  // The address changes before the page does: until then the panel, with the same title, is still there.
  await expect(panel).toHaveCount(0);
  await expect(page.getByLabel("Title")).toHaveValue(title);
  const response = await saved;
  expect(response.ok()).toBe(true);
  // A shared project's optimistic number can change, so the key is read from the committed row.
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const loaded = await page.request.post(response.url().replace(/\/transactions$/, "/load"), {
    data: { queries: [{ model: "Issue", where: { id } }, { model: "Project" }] },
  });
  expect(loaded.ok()).toBe(true);
  const { rows } = await loaded.json();
  expect(rows.Issue).toHaveLength(1);
  const issue = rows.Issue[0];
  const project = rows.Project.find((project: { id: string }) => project.id === issue.projectId);
  expect(project).toBeDefined();
  const key = `${project.identifier}-${issue.number}`;
  await expect(heading(page)).toHaveText(key);
  return key;
}

/** A new project with one issue, open on its page. */
export async function openIssue(page: Page, prefix: string) {
  await newProject(page, prefix);
  await createAndOpen(page, `${prefix} ${Date.now()}`);
}

export async function choose(page: Page, trigger: Locator, option: string) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function filter(page: Page, section: string, option: string) {
  await page.getByRole("button", { name: "Filters" }).click();
  await page
    .getByRole("dialog", { name: "Filters" })
    .getByRole("group", { name: section })
    .getByRole("checkbox", { name: option, exact: true })
    .click();
  await page.keyboard.press("Escape");
}

export async function display(page: Page, change: (panel: Locator) => Promise<void>) {
  await page.getByRole("button", { name: "Display" }).click();
  const panel = page.getByRole("dialog", { name: "Display" });
  await change(panel);
  // Base UI radio menus stay open after selection, so the submenu is dismissed before its parent panel.
  if (await page.locator('[role="menu"]').count()) await page.keyboard.press("Escape");
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
}

export const groupBy = (page: Page, option: string) =>
  display(page, async (panel) => {
    await panel.getByRole("button", { name: "Grouping" }).click();
    await page.getByRole("menuitemradio", { name: option }).click();
  });

export const layout = (page: Page, name: "List" | "Board" | "Spreadsheet" | "Calendar" | "Timeline") =>
  page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name, exact: true }).click();

export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

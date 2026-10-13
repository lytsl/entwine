import {
  choose,
  createIssue,
  display,
  filter,
  groupBy,
  heading,
  isoDay,
  layout,
  newProject,
  openProject,
  peek,
  row,
  search,
  sidebar,
} from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("the board groups by priority, and dropping a card sets it for every member; sub-issues hide and expand", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Board");
  await createIssue(ada, "Plan the launch");
  const panel = await peek(ada, "Plan the launch");
  await panel.getByRole("button", { name: "Add sub-issue" }).click();
  await ada.getByRole("menuitem", { name: "New sub-issue" }).click();
  await ada.getByLabel("Sub-issue title").fill("Book the venue");
  await ada.getByLabel("Sub-issue title").press("Enter");
  await expect(panel.getByRole("list", { name: "Sub-issues" }).getByText("Book the venue")).toBeVisible();
  await ada.getByRole("button", { name: "Close preview" }).click();

  await expect(ada.getByTestId("issue-row")).toHaveText([/Book the venue/, /Plan the launch/]);
  await display(ada, (p) => p.getByRole("switch", { name: "Show sub-issues" }).click());
  await expect(ada.getByTestId("issue-row")).toHaveText([/Plan the launch/]);
  await row(ada, "Plan the launch")
    .getByRole("button", { name: /Expand sub-issues/ })
    .click();
  await expect(ada.getByTestId("issue-row")).toHaveText([/Plan the launch/, /Book the venue/]);

  await groupBy(ada, "Priority");
  await layout(ada, "Board");
  const columns = ada.getByRole("region").filter({ has: ada.getByRole("heading", { level: 2 }) });
  await expect(columns).toHaveText([/Urgent/, /High/, /Medium/, /Low/, /No priority/]);
  // The next column: a drag that has to scroll the board on its way loses its drop.
  const card = ada.getByTestId("issue-card").filter({ hasText: "Plan the launch" });
  await card.dragTo(ada.getByRole("region", { name: "Low" }));
  await expect(ada.getByRole("region", { name: "Low" }).getByText("Plan the launch")).toBeVisible();

  const bob = await signIn(browser, "bob");
  await bob.goto(ada.url());
  await expect(bob.getByRole("region", { name: "Low" }).getByText("Plan the launch")).toBeVisible();
});

test("the calendar shows issues on their due date, and dragging one reschedules it", async ({ browser }) => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 10);
  const to = new Date(now.getFullYear(), now.getMonth(), 17);
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Dates");
  const title = `Release ${Date.now()}`;
  await createIssue(ada, title);
  const panel = await peek(ada, title);
  await panel.getByLabel("Due date: none").click();
  await ada
    .getByRole("button", { name: new RegExp(`${from.toLocaleDateString("en-US", { month: "long" })} 10(st|nd|rd|th)`) })
    .click();
  await expect(panel.getByLabel(/Due date: \w+ 10, \d{4}/)).toBeVisible();
  await ada.getByRole("button", { name: "Close preview" }).click();

  await layout(ada, "Calendar");
  await expect(ada.locator(`[data-day="${isoDay(from)}"]`).getByText(title)).toBeVisible();
  await ada
    .getByTestId("calendar-issue")
    .filter({ hasText: title })
    .dragTo(ada.locator(`[data-day="${isoDay(to)}"]`));
  await expect(ada.locator(`[data-day="${isoDay(to)}"]`).getByText(title)).toBeVisible();

  const bob = await signIn(browser, "bob");
  await bob.goto(ada.url());
  await bob.getByTestId("calendar-issue").filter({ hasText: title }).click();
  await expect(
    bob.getByRole("complementary", { name: "Issue preview" }).getByLabel(/Due date: \w+ 17, \d{4}/),
  ).toBeVisible();
});

test("All issues spans projects, filters by project, and edits in the spreadsheet", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Sheet");
  const title = `Sheet ${Date.now()}`;
  await createIssue(ada, title);
  await sidebar(ada).getByRole("link", { name: "All issues" }).click();
  await expect(heading(ada)).toHaveText("All issues");
  await search(ada, "Redesign the landing page");
  await expect(row(ada, "Redesign the landing page")).toBeVisible();
  await filter(ada, "Project", project.name);
  await expect(row(ada, "Redesign the landing page")).toHaveCount(0);
  await ada.getByLabel("Search issues").press("Escape");
  await expect(ada.getByRole("link", { name: title })).toBeVisible();

  await layout(ada, "Spreadsheet");
  const line = ada.getByRole("row").filter({ hasText: title });
  await choose(ada, line.getByLabel("Priority: No priority"), "Low");

  const cy = await signIn(browser, "cy");
  await cy.goto(ada.url());
  await expect(cy.getByRole("row").filter({ hasText: title }).getByLabel("Priority: Low")).toBeVisible();
});

test("applied filters show as items: one is removed alone, and hidden properties leave the rows", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await filter(ada, "Priority", "High");
  await filter(ada, "Label", "Feature");
  const applied = ada.getByRole("group", { name: "Applied filters" });
  await expect(applied.getByRole("group", { name: "Priority filter" })).toContainText("High");
  await applied.getByRole("button", { name: "Remove priority filter" }).click();
  await expect(applied.getByRole("group", { name: "Priority filter" })).toHaveCount(0);
  await expect(applied.getByRole("group", { name: "Label filter" })).toBeVisible();
  await expect(ada.getByTestId("issue-row")).toHaveText([/Add a pricing page/, /Redesign the landing page/]);

  await expect(row(ada, "Add a pricing page").getByLabel(/^Labels:/)).toBeVisible();
  await display(ada, (panel) =>
    panel.getByRole("group", { name: "Display properties" }).getByRole("button", { name: "Labels" }).click(),
  );
  await expect(row(ada, "Add a pricing page").getByLabel(/^Labels:/)).toHaveCount(0);
  await expect(ada).toHaveURL(/properties=/);

  await applied.getByRole("button", { name: "Clear all" }).click();
  const backlog = ada.getByRole("region", { name: "Backlog" });
  await backlog.getByRole("button", { name: /^Backlog/ }).click();
  await expect(backlog.getByTestId("issue-row")).toHaveCount(0);
  await expect(backlog.getByRole("button", { name: /^Backlog/ })).toHaveAttribute("aria-expanded", "false");
});

test("a saved view is shared, opens with its settings, and only its creator updates it", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await filter(ada, "Priority", "High");
  await layout(ada, "Board");
  const name = `Hot ${Date.now()}`;
  await ada.getByRole("button", { name: "Save view" }).click();
  await ada.getByLabel("View name").fill(name);
  await ada.getByRole("dialog").getByRole("button", { name: "Save view" }).click();
  await expect(heading(ada)).toHaveText(name);

  const cy = await signIn(browser, "cy");
  await sidebar(cy).getByRole("link", { name: "Views" }).click();
  const item = cy.getByRole("listitem", { name });
  await item.getByRole("button", { name: `${name} actions` }).click();
  await expect(cy.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
  await cy.keyboard.press("Escape");
  await item.getByRole("link", { name }).click();
  await expect(cy.getByTestId("issue-card").filter({ hasText: "Redesign the landing page" })).toBeVisible();
  await expect(cy.getByText("Fix broken footer links")).toHaveCount(0);

  await layout(cy, "List");
  await expect(cy.getByRole("button", { name: "Update view" })).toHaveCount(0);
  await expect(cy.getByRole("button", { name: "Save as new view" })).toBeVisible();
  await cy.getByRole("button", { name: "Reset" }).click();
  await expect(cy.getByTestId("issue-card")).not.toHaveCount(0);

  await filter(ada, "Priority", "Urgent");
  await ada.getByRole("button", { name: "Update view" }).click();
  await expect(ada.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await expect(cy.getByTestId("issue-card").filter({ hasText: "Fix broken footer links" })).toBeVisible();
});

test("a view made on the Views page opens on every issue, ready to filter", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await sidebar(ada).getByRole("link", { name: "Views" }).click();
  await ada.getByRole("button", { name: "New view" }).click();
  const name = `Everything ${Date.now()}`;
  await ada.getByLabel("View name").fill(name);
  await ada.getByRole("button", { name: "Create view" }).click();
  await expect(heading(ada)).toHaveText(name);
  for (const title of ["Redesign the landing page", "Rate-limit the search endpoint"]) {
    await search(ada, title);
    await expect(row(ada, title)).toBeVisible();
  }
});

test("a long view renders the issues near the viewport, while keys, ranges and select-all reach them all", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  // A short window, so that few issues are more than a layout renders at once: every issue made here is also a
  // change for the pages of the specs running beside this one, which share the workspace.
  await ada.setViewportSize({ width: 1280, height: 420 });
  await newProject(ada, "Endless");
  const count = 32;
  await ada.getByRole("region", { name: "Backlog" }).getByRole("button", { name: "New issue", exact: true }).click();
  const quickAdd = ada.getByLabel("Issue title in Backlog");
  for (let n = 1; n <= count; n++) {
    await quickAdd.fill(`Long ${n}`);
    await quickAdd.press("Enter");
  }
  await quickAdd.press("Escape");
  await expect(ada.getByTitle(`${count} issues`)).toBeVisible();
  // The newest is first.
  const titled = (n: number) => ({ has: ada.getByRole("link", { name: `Long ${n}`, exact: true }) });
  const rows = ada.getByTestId("issue-row");
  const bar = ada.getByRole("toolbar", { name: "Selected issues" });
  const focused = ada.locator("[data-issue-id][data-focused]");
  /** Escape clears the selection, then the focus. */
  const reset = async () => {
    await ada.keyboard.press("Escape");
    await expect(bar).toHaveCount(0);
    await ada.keyboard.press("Escape");
    await expect(focused).toHaveCount(0);
  };

  // J walks past the screen to the last issue.
  for (let n = 1; n <= count; n++) await ada.keyboard.press("j");
  await expect(focused.filter(titled(1))).toBeInViewport();
  expect(await rows.count()).toBeLessThan(count);
  await expect(rows.filter(titled(count))).toHaveCount(0);
  await ada.keyboard.press("Escape");
  await expect(focused).toHaveCount(0);

  await ada.keyboard.press("ControlOrMeta+a");
  await expect(bar).toContainText(`${count} selected`);
  await ada.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);

  // A range from the first issue to the last, which are never on screen together.
  await ada.keyboard.press("j");
  await rows.filter(titled(count)).getByRole("checkbox").click();
  await ada.mouse.wheel(0, 100_000);
  await rows
    .filter(titled(1))
    .getByRole("checkbox")
    .click({ modifiers: ["Shift"] });
  await expect(bar).toContainText(`${count} selected`);
  await reset();

  await layout(ada, "Spreadsheet");
  const tableRows = ada.getByRole("table", { name: "Issues" }).getByRole("row");
  await expect(tableRows.filter(titled(count))).toBeVisible();
  expect(await tableRows.count()).toBeLessThan(count);
  await ada.keyboard.press("k");
  await expect(focused.filter(titled(1))).toBeInViewport();
  await ada.keyboard.press("ControlOrMeta+a");
  await expect(bar).toContainText(`${count} selected`);
  await reset();

  await layout(ada, "Board");
  const cards = ada.getByRole("region", { name: "Backlog" }).getByTestId("issue-card");
  await expect(cards.filter(titled(count))).toBeVisible();
  expect(await cards.count()).toBeLessThan(count);
  await ada.keyboard.press("k");
  await expect(focused.filter(titled(1))).toBeInViewport();
  await ada.keyboard.press("ControlOrMeta+a");
  await expect(bar).toContainText(`${count} selected`);
});

test("the search box shows what is typed at once and filters once typing pauses; Escape clears it", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  const rows = ada.getByTestId("issue-row");
  await ada.keyboard.press("/");
  const box = ada.getByLabel("Search issues");

  await box.pressSequentially("footer links");
  await expect(box).toHaveValue("footer links");
  await expect(rows).toHaveText([/Fix broken footer links/]);
  await expect(ada).toHaveURL(/[?&]q=footer(\+|%20)links/);

  await box.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(ada).not.toHaveURL(/[?&]q=/);
  await expect(rows.filter({ hasText: "Redesign the landing page" })).toBeVisible();

  // A search cleared from elsewhere leaves the box too.
  await ada.keyboard.press("/");
  await box.pressSequentially("no such issue");
  await ada.getByRole("button", { name: "Clear filters" }).click();
  await expect(box).toHaveValue("");
  await expect(rows.filter({ hasText: "Redesign the landing page" })).toBeVisible();
});

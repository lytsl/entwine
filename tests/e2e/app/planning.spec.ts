import type { Locator, Page } from "@playwright/test";
import {
  choose,
  createIssue,
  display,
  filter,
  heading,
  layout,
  newPlan,
  newProject,
  openPage,
  openProject,
  peek,
  progress,
  row,
  sidebar,
} from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

async function openPlan(page: Page, name: string) {
  await page.getByRole("link", { name, exact: true }).click();
  await expect(heading(page)).toHaveText(name);
}

/** Matches by prefix: a plan's option also names its phase or status. */
async function pick(page: Page, trigger: Locator, name: string) {
  await trigger.click();
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
}

test("cycles are created, edited and listed by phase, live for every member", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Cycles");
  await openProject(bob, project.name);
  await openPage(ada, "Cycles");
  await openPage(bob, "Cycles");
  await expect(bob.getByText("No cycles yet")).toBeVisible();

  // A new cycle runs two weeks from today, so it is current.
  await newPlan(ada, "cycle", "Sprint A");
  const current = bob.getByRole("region", { name: "Current" });
  await expect(current.getByRole("listitem", { name: "Sprint A" })).toContainText("14 days left");

  await ada.getByRole("button", { name: "Sprint A actions" }).click();
  await ada.getByRole("menuitem", { name: "Edit" }).click();
  await ada.getByRole("dialog").getByLabel("Name").fill("Sprint One");
  await ada.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
  await expect(current.getByRole("listitem", { name: "Sprint One" })).toBeVisible();

  await bob.getByLabel("Search cycles").fill("nothing like it");
  await expect(bob.getByText("No cycles match")).toBeVisible();
  await ada.screenshot({ path: test.info().outputPath("cycles.png"), fullPage: true });
});

test("a cycle's page lists its issues; issues are added, created and moved in scope", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Scope");
  await createIssue(ada, "Outside the cycle");
  await createIssue(ada, "Picked for the cycle");
  await openPage(ada, "Cycles");
  await newPlan(ada, "cycle", "Focus");
  await openPlan(ada, "Focus");
  await expect(progress(ada)).toContainText("0 of 0 done");

  await ada.getByRole("button", { name: "Add existing" }).click();
  await ada.getByRole("option", { name: /Picked for the cycle/ }).click();
  await ada.getByRole("button", { name: "Add 1 issue" }).click();
  await expect(row(ada, "Picked for the cycle")).toBeVisible();
  await expect(row(ada, "Outside the cycle")).toHaveCount(0);

  const backlog = ada.getByRole("region", { name: "Backlog" });
  await backlog.getByRole("button", { name: "New issue", exact: true }).click();
  await ada.getByLabel("Issue title in Backlog").fill("Quick in cycle");
  await ada.getByLabel("Issue title in Backlog").press("Enter");
  await ada.getByLabel("Issue title in Backlog").press("Escape");
  await createIssue(ada, "Dialog in cycle");
  await expect(ada.getByTestId("issue-row")).toHaveCount(3);
  await expect(progress(ada)).toContainText("0 of 3 done");

  await choose(ada, row(ada, "Quick in cycle").getByLabel(/^State:/), "Done");
  await expect(progress(ada)).toContainText("1 of 3 done");

  await filter(ada, "Priority", "High");
  await expect(ada.getByTestId("issue-row")).toHaveCount(0);
  await ada.getByRole("button", { name: "Clear filters" }).click();
  await expect(ada.getByTestId("issue-row")).toHaveCount(3);
  await expect(row(ada, "Outside the cycle")).toHaveCount(0);

  await layout(ada, "Spreadsheet");
  await expect(ada.getByRole("table", { name: "Issues" }).getByRole("row")).toHaveCount(4);
  await layout(ada, "Board");
  await expect(ada.getByTestId("issue-card")).toHaveCount(3);
  await layout(ada, "List");
  const panel = await peek(ada, "Picked for the cycle");
  await expect(panel.getByLabel("Cycle: Focus")).toBeVisible();
  await ada.reload();
  await expect(ada.getByRole("complementary", { name: "Issue preview" }).getByLabel("Title")).toHaveValue(
    "Picked for the cycle",
  );

  await choose(ada, ada.getByRole("complementary", { name: "Issue preview" }).getByLabel("Cycle: Focus"), "No cycle");
  await expect(row(ada, "Picked for the cycle")).toHaveCount(0);
  await ada.screenshot({ path: test.info().outputPath("cycle-page.png"), fullPage: true });
});

test("an issue is in several modules, whose status and progress are separate", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Modules");
  await createIssue(ada, "Shared work");
  await openPage(ada, "Modules");
  await newPlan(ada, "module", "Alpha");
  await newPlan(ada, "module", "Beta");
  await expect(ada.getByRole("region", { name: "Backlog" }).getByRole("listitem")).toHaveCount(2);

  await openProject(ada, project.name);
  const panel = await peek(ada, "Shared work");
  await pick(ada, panel.getByLabel("Modules", { exact: true }), "Alpha");
  await ada.keyboard.press("Escape");
  await pick(ada, panel.getByLabel("Modules: Alpha"), "Beta");
  await ada.keyboard.press("Escape");
  await expect(panel.getByTestId("activity").filter({ hasText: "added the issue to the module Beta" })).toBeVisible();
  await ada.getByRole("button", { name: "Close preview" }).click();

  await openProject(bob, project.name);
  await openPage(bob, "Modules");
  await expect(bob.getByRole("listitem", { name: "Alpha" })).toContainText("0 of 1 done");
  await choose(ada, row(ada, "Shared work").getByLabel(/^State:/), "Done");
  for (const name of ["Alpha", "Beta"]) {
    const card = bob.getByRole("listitem", { name });
    await expect(card).toContainText("1 of 1 done");
    await expect(card.getByLabel("Status: Backlog")).toBeVisible();
  }

  await choose(bob, bob.getByRole("listitem", { name: "Alpha" }).getByLabel("Status: Backlog"), "In progress");
  await expect(bob.getByRole("region", { name: "In progress" }).getByRole("listitem", { name: "Alpha" })).toBeVisible();
  await bob.screenshot({ path: test.info().outputPath("modules.png"), fullPage: true });
});

test("the Display panel hides the cycle and modules, and the dialog sets them", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  // Not "Display…": the project's sidebar menu would then match the Display panel's button.
  const project = await newProject(ada, "Hiding");
  await openPage(ada, "Cycles");
  await newPlan(ada, "cycle", "Sprint X");
  await openPage(ada, "Modules");
  await newPlan(ada, "module", "Payments");
  await openProject(ada, project.name);

  await ada.keyboard.press("c");
  const dialog = ada.getByRole("dialog");
  const title = "Planned at birth";
  await dialog.getByLabel("Title").fill(title);
  await pick(ada, dialog.getByLabel("Cycle: No cycle"), "Sprint X");
  await pick(ada, dialog.getByLabel("Modules", { exact: true }), "Payments");
  await ada.keyboard.press("Escape");
  await dialog.getByRole("button", { name: "Create issue" }).click();
  await expect(row(ada, title).getByLabel("Cycle: Sprint X")).toBeVisible();
  await expect(row(ada, title).getByLabel("Modules: Payments")).toBeVisible();

  await display(ada, async (panel) => {
    const properties = panel.getByRole("group", { name: "Display properties" });
    await properties.getByRole("button", { name: "Cycle" }).click();
    await properties.getByRole("button", { name: "Modules" }).click();
  });
  await expect(row(ada, title).getByLabel("Cycle: Sprint X")).toHaveCount(0);
  await expect(row(ada, title).getByLabel("Modules: Payments")).toHaveCount(0);
  await layout(ada, "Spreadsheet");
  await expect(ada.getByRole("columnheader", { name: "Cycle" })).toHaveCount(0);
});

test("cycle and module filters apply in the URL and in a saved view", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await filter(ada, "Cycle", "Sprint 2");
  await filter(ada, "Cycle", "Sprint 3");
  await filter(ada, "Module", "Launch");
  const titles = ["Redesign the landing page", "Fix broken footer links", "Add a pricing page"];
  for (const title of titles) await expect(row(ada, title)).toBeVisible();
  await expect(row(ada, "Compress hero images")).toHaveCount(0);
  await ada.reload();
  await expect(ada.getByRole("group", { name: "Cycle filter" })).toContainText("Sprint 2, Sprint 3");
  await expect(row(ada, "Compress hero images")).toHaveCount(0);

  await ada.getByRole("button", { name: "Save view" }).click();
  const name = `Planned ${Date.now()}`;
  await ada.getByLabel("View name").fill(name);
  await ada.getByRole("dialog").getByRole("button", { name: "Save view" }).click();
  await expect(heading(ada)).toHaveText(name);
  await ada.reload();
  await expect(ada.getByRole("group", { name: "Module filter" })).toContainText("Launch");
  for (const title of titles) await expect(row(ada, title)).toBeVisible();

  // No cycle and no module: only unplanned issues.
  await openProject(ada, "Website");
  await filter(ada, "Cycle", "No cycle");
  await filter(ada, "Module", "No module");
  await expect(row(ada, "Compress hero images")).toHaveCount(0);
  await expect(row(ada, "Redesign the landing page")).toHaveCount(0);
  await expect(row(ada, "Draft the hero copy")).toBeVisible();
});

test("a deleted cycle's page says so, and its issues stay without a cycle", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Gone");
  await createIssue(ada, "Survivor");
  await openPage(ada, "Cycles");
  await newPlan(ada, "cycle", "Doomed");
  await openPlan(ada, "Doomed");
  await ada.getByRole("button", { name: "Add existing" }).click();
  await ada.getByRole("option", { name: /Survivor/ }).click();
  await ada.getByRole("button", { name: "Add 1 issue" }).click();
  await expect(row(ada, "Survivor")).toBeVisible();

  await openProject(bob, project.name);
  await openPage(bob, "Cycles");
  await openPlan(bob, "Doomed");
  await ada.getByRole("button", { name: "Doomed actions" }).click();
  await ada.getByRole("menuitem", { name: "Delete" }).click();
  await ada.getByRole("button", { name: "Delete cycle" }).click();
  await expect(heading(ada)).toHaveText("Cycles");
  await expect(bob.getByText("This cycle no longer exists.")).toBeVisible();

  await openProject(bob, project.name);
  const panel = await peek(bob, "Survivor");
  await expect(panel.getByLabel("Cycle: No cycle")).toBeVisible();
  await expect(panel.getByTestId("activity").filter({ hasText: "removed the issue from the cycle" })).toBeVisible();
});

test("an archived project's plans are read-only", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Frozen");
  await openPage(ada, "Modules");
  await newPlan(ada, "module", "Kept");
  await ada.getByRole("link", { name: "Settings", exact: true }).click();
  await ada.getByRole("button", { name: "Archive project" }).click();
  await ada.goto(ada.url().replace(/settings$/, "modules"));
  await expect(heading(ada)).toHaveText("Modules");
  await expect(ada.getByText(`${project.name} is archived`)).toBeVisible();
  await expect(ada.getByRole("button", { name: "New module" })).toBeDisabled();
  await expect(ada.getByRole("listitem", { name: "Kept" }).getByLabel("Status: Backlog")).toBeDisabled();
  await openPlan(ada, "Kept");
  await expect(ada.getByRole("button", { name: "Add existing" })).toBeDisabled();
});

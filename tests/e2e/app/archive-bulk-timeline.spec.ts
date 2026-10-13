import { addDays } from "@entwine/shared";
import type { Page } from "@playwright/test";
import { createIssue, heading, layout, newProject, peek, row, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

const menu = async (page: Page, title: string) => {
  await row(page, title).click({ button: "right" });
  return page.getByRole("menu");
};

async function setState(page: Page, title: string, state: string) {
  await (await menu(page, title)).getByRole("menuitem", { name: "State" }).click();
  await page.getByRole("menuitemradio", { name: state }).click();
  await expect(row(page, title).getByLabel(`State: ${state}`)).toBeVisible();
}

test("a done issue is archived, leaves the view and comes back from the Archives page", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Archive");
  const stamp = Date.now();
  const done = `Finished ${stamp}`;
  const open = `Still open ${stamp}`;
  await createIssue(ada, done);
  await createIssue(ada, open);

  const items = await menu(ada, open);
  await expect(items.getByRole("menuitem", { name: /^Archive/ })).toBeDisabled();
  await ada.keyboard.press("Escape");

  await setState(ada, done, "Done");
  await (await menu(ada, done)).getByRole("menuitem", { name: /^Archive/ }).click();
  await expect(row(ada, done)).toHaveCount(0);

  await sidebar(ada)
    .getByRole("button", { name: `${project.name} actions` })
    .click();
  await ada.getByRole("menuitem", { name: "Archived issues" }).click();
  await expect(heading(ada)).toHaveText("Archives");
  const archived = ada.getByRole("list", { name: "Archived issues" }).getByRole("listitem");
  await expect(archived).toHaveCount(1);
  await expect(archived).toContainText(done);
  await archived.getByRole("button", { name: /^Restore/ }).click();
  await expect(archived).toHaveCount(0);

  await sidebar(ada).getByRole("link", { name: project.name, exact: true }).click();
  await expect(row(ada, done).getByLabel("State: Done")).toBeVisible();
});

test("an archived issue's page is read-only until it is restored", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Frozen");
  const title = `Frozen ${Date.now()}`;
  await createIssue(ada, title);
  await setState(ada, title, "Done");
  const panel = await peek(ada, title);
  await panel.getByRole("link", { name: "Open issue page" }).click();
  await expect(panel).toHaveCount(0);
  await expect(ada.getByLabel("Title")).toHaveValue(title);
  const key = await heading(ada).textContent();

  await ada.getByRole("button", { name: `${key} actions` }).click();
  await ada.getByRole("menuitem", { name: /^Archive/ }).click();
  await expect(ada.getByRole("status").filter({ hasText: "This issue is archived" })).toBeVisible();
  await expect(ada.getByLabel("Title")).toHaveAttribute("readonly", "");
  await expect(
    ada.getByRole("region", { name: "Properties" }).getByRole("button", { name: /^Priority/ }),
  ).toBeDisabled();
  await expect(ada.getByLabel("Comment", { exact: true })).toHaveCount(0);

  await ada
    .getByRole("status")
    .filter({ hasText: "This issue is archived" })
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(ada.getByLabel("Title")).not.toHaveAttribute("readonly");
  await expect(ada.getByLabel("Comment", { exact: true })).toBeVisible();
});

test("Make a copy opens the new-issue dialog with the issue's values and '(copy)'", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Copy");
  const title = `Original ${Date.now()}`;
  await createIssue(ada, title);
  await setState(ada, title, "In Progress");

  await (await menu(ada, title)).getByRole("menuitem", { name: "Make a copy" }).click();
  const dialog = ada.getByRole("dialog");
  await expect(dialog.getByLabel("Title")).toHaveValue(`${title} (copy)`);
  await dialog.getByRole("button", { name: "Create issue" }).click();
  await expect(row(ada, `${title} (copy)`).getByLabel("State: In Progress")).toBeVisible();
  await expect(row(ada, title)).toHaveCount(2);
});

test("a range of issues gets a priority in one edit, which one undo reverts", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Bulk");
  const stamp = Date.now();
  for (const n of [1, 2, 3, 4, 5]) await createIssue(ada, `Bulk ${n} ${stamp}`);
  const boxes = ada.getByRole("checkbox", { name: /^Select / });

  await boxes.nth(0).click();
  await boxes.nth(3).click({ modifiers: ["Shift"] });
  const bar = ada.getByRole("toolbar", { name: "Selected issues" });
  await expect(bar).toContainText("4 selected");
  // Issues of one project that are not finished: no archive.
  await expect(bar.getByRole("button", { name: "State" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Archive" })).toHaveCount(0);

  await bar.getByRole("button", { name: "Priority" }).click();
  await ada.getByRole("menuitemradio", { name: "High" }).click();
  await expect(ada.getByTestId("issue-row").getByLabel("Priority: High")).toHaveCount(4);

  // Escape closes the menu if it is still open, then clears the selection.
  await ada.keyboard.press("Escape");
  await expect(ada.getByRole("menu")).toHaveCount(0);
  await ada.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  await ada.keyboard.press("ControlOrMeta+z");
  await expect(ada.getByTestId("issue-row").getByLabel("Priority: High")).toHaveCount(0);
});

test("a timeline bar is scheduled by a click, moved by a drag and resized by its end", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Gantt");
  const title = `Planned ${Date.now()}`;
  await createIssue(ada, title);
  await layout(ada, "Timeline");
  await expect(ada).toHaveURL(/layout=timeline/);

  const line = ada.getByTestId("timeline-row").filter({ hasText: title });
  await line.getByTestId("timeline-track").click({ position: { x: 400, y: 20 } });
  const bar = line.getByTestId("timeline-bar");
  await expect(bar).toBeVisible();
  const day = (await bar.getAttribute("data-start"))!;
  await expect(bar).toHaveAttribute("data-end", day);

  // The month scale draws a day in 20 pixels.
  const drag = async (target: typeof bar, days: number) => {
    const box = (await target.boundingBox())!;
    const y = box.y + box.height / 2;
    const x = box.x + box.width / 2;
    await ada.mouse.move(x, y);
    await ada.mouse.down();
    await ada.mouse.move(x + days * 10, y, { steps: 4 });
    await ada.mouse.move(x + days * 20, y, { steps: 4 });
    await ada.mouse.up();
  };
  await drag(bar, 2);
  await expect(bar).toHaveAttribute("data-start", addDays(day, 2));
  await expect(bar).toHaveAttribute("data-end", addDays(day, 2));

  await drag(bar.getByTestId("timeline-end"), 3);
  await expect(bar).toHaveAttribute("data-end", addDays(day, 5));
  await expect(bar).toHaveAttribute("data-start", addDays(day, 2));
  await expect(line).toContainText("4 days");
});

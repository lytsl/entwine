import { createIssue, heading, layout, newProject, openProject, peek, row, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

const palette = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Command palette" });

test("the palette finds an issue of another project by key and opens it beside the view", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const other = await newProject(ada, "Far");
  const title = `Far away ${Date.now()}`;
  await createIssue(ada, title);
  await newProject(ada, "Near");

  await ada.keyboard.press("ControlOrMeta+k");
  await palette(ada).getByRole("combobox").fill(`${other.identifier}-1`);
  await palette(ada)
    .getByRole("option", { name: new RegExp(title) })
    .click();
  await expect(palette(ada)).toHaveCount(0);
  await expect(ada.getByRole("complementary", { name: "Issue preview" }).getByLabel("Title")).toHaveValue(title);
  await expect(heading(ada)).toHaveText("Issues");
});

test("the palette finds an issue of another project by a comment, after one found by its title", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  const word = `quokka${Date.now()}`;
  await newProject(ada, "Deep");
  await createIssue(ada, `Feed the ${word}`);
  const commented = `Commented ${Date.now()}`;
  await createIssue(ada, commented);
  const panel = await peek(ada, commented);
  const composer = panel.getByLabel("Comment", { exact: true });
  await composer.click();
  await ada.keyboard.type(`Seen near the ${word} enclosure`);
  await panel.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(panel.getByTestId("comment").filter({ hasText: word })).toBeVisible();

  // A browser that never opened the project.
  const bob = await signIn(browser, "bob");
  await bob.keyboard.press("ControlOrMeta+k");
  await palette(bob).getByRole("combobox").fill(word);
  const found = palette(bob).getByRole("group", { name: "Issues" }).getByRole("option");
  await expect(found).toHaveText([new RegExp(`Feed the ${word}`), new RegExp(`${commented}.*near the ${word}`)]);
});

test("the palette opens from the sidebar and changes the state of the issue in the peek", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Palette");
  const title = `Stateful ${Date.now()}`;
  await createIssue(ada, title);
  await peek(ada, title);

  await sidebar(ada)
    .getByRole("button", { name: /^Search/ })
    .click();
  await palette(ada)
    .getByRole("option", { name: /^Change state/ })
    .click();
  await palette(ada).getByRole("option", { name: "In Progress", exact: true }).click();
  await expect(palette(ada)).toHaveCount(0);
  await expect(row(ada, title).getByLabel("State: In Progress")).toBeVisible();
});

test("J, K and Enter move through the list and open the focused issue; P sets its priority", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Keys");
  const stamp = Date.now();
  // The list orders by priority, then newest first.
  for (const n of [1, 2, 3]) await createIssue(ada, `Key ${n} ${stamp}`);
  const focused = ada.locator("[data-issue-id][data-focused]");

  await ada.keyboard.press("j");
  await ada.keyboard.press("j");
  await ada.keyboard.press("j");
  await ada.keyboard.press("k");
  await expect(focused).toContainText(`Key 2 ${stamp}`);
  await ada.keyboard.press("Enter");
  const panel = ada.getByRole("complementary", { name: "Issue preview" });
  await expect(panel.getByLabel("Title")).toHaveValue(`Key 2 ${stamp}`);

  await ada.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(focused).toContainText(`Key 2 ${stamp}`);
  await ada.keyboard.press("p");
  await palette(ada).getByRole("option", { name: "High", exact: true }).click();
  await expect(row(ada, `Key 2 ${stamp}`).getByLabel("Priority: High")).toBeVisible();

  await ada.keyboard.press("Escape");
  await expect(focused).toHaveCount(0);
  await ada.keyboard.press("p");
  await expect(palette(ada)).toHaveCount(0);
});

test("G then P goes to projects, and V then B shows the board", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await ada.keyboard.press("v");
  await ada.keyboard.press("b");
  await expect(ada).toHaveURL(/layout=board/);
  await expect(ada.getByTestId("issue-card").first()).toBeVisible();

  await ada.keyboard.press("g");
  await ada.keyboard.press("p");
  await expect(heading(ada)).toHaveText("Projects");
});

test("the key after G is the sequence's own, and ⌘Z in the search box is the box's", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Jumps");
  const title = `Sequenced ${Date.now()}`;
  await createIssue(ada, title);
  const bar = ada.getByRole("toolbar", { name: "Selected issues" });

  // G then X is no sequence, and its X does not select: had it, the next X would clear the selection.
  await ada.keyboard.press("j");
  await ada.keyboard.press("g");
  await ada.keyboard.press("x");
  await ada.keyboard.press("x");
  await expect(bar).toContainText("1 selected");
  await ada.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);

  // Undo in a text field takes back typing, not the creation of the issue.
  await ada.keyboard.press("/");
  const search = ada.getByLabel("Search issues");
  await search.pressSequentially("Seq");
  await expect(search).toHaveValue("Seq");
  await search.press("ControlOrMeta+z");
  await expect(search).not.toHaveValue("Seq");
  await expect(row(ada, title)).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveCount(0);

  // G then C goes to the cycles; its C does not start an issue.
  await ada.keyboard.press("g");
  await ada.keyboard.press("c");
  await expect(heading(ada)).toHaveText("Cycles");
  await expect(ada.getByRole("dialog")).toHaveCount(0);
});

test("typing in a comment box is not a shortcut", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  const panel = await peek(ada, "Redesign the landing page");
  const box = panel.getByLabel("Comment", { exact: true });
  await box.click();
  await ada.keyboard.type("sap");
  await expect(box).toHaveText("sap");
  await expect(palette(ada)).toHaveCount(0);
});

test("right-clicking a card opens its menu, whose State submenu moves it", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Menu");
  const title = `Right-clicked ${Date.now()}`;
  await createIssue(ada, title);
  await layout(ada, "Board");

  await ada.getByTestId("issue-card").filter({ hasText: title }).click({ button: "right" });
  await ada.getByRole("menuitem", { name: "State" }).click();
  await ada.getByRole("menuitemradio", { name: "Done" }).click();
  await expect(ada.getByRole("region", { name: "Done" }).getByText(title)).toBeVisible();

  await ada
    .getByTestId("issue-card")
    .filter({ hasText: title })
    .getByRole("button", { name: /actions$/ })
    .click();
  for (const item of ["State", "Priority", "Assignee"])
    await expect(ada.getByRole("menuitem", { name: item })).toBeVisible();
  for (const item of ["Open", "Open in new tab", "Copy link", "Copy key", "Delete"])
    await expect(ada.getByRole("menuitem", { name: item, exact: true })).toBeVisible();
});

test("? lists the shortcuts, filtered by what is typed", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await ada.keyboard.press("?");
  const list = ada.getByRole("dialog", { name: "Keyboard shortcuts" });
  await list.getByLabel("Filter shortcuts").fill("priority");
  await expect(list.getByText("Change priority")).toBeVisible();
  await expect(list.getByText("New issue")).toHaveCount(0);
});

test("single-key shortcuts can be turned off, and stay off across a reload", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const list = ada.getByRole("dialog", { name: "Keyboard shortcuts" });
  const newIssue = ada.getByRole("dialog", { name: "New issue" });
  await ada.keyboard.press("?");
  await list.getByRole("switch", { name: "Single-key shortcuts" }).click();
  await expect(list.getByText("Off").first()).toBeVisible();
  await ada.keyboard.press("Escape");
  await expect(list).toHaveCount(0);

  await ada.reload();
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
  await ada.keyboard.press("c");
  await ada.keyboard.press("?");
  // A shortcut with a modifier still works, and shows that the single keys before it did nothing.
  await ada.keyboard.press("ControlOrMeta+k");
  await expect(palette(ada)).toBeVisible();
  await expect(newIssue).toHaveCount(0);
  await expect(list).toHaveCount(0);

  await palette(ada).getByRole("combobox").fill("keyboard shortcuts");
  await palette(ada).getByRole("option", { name: "Keyboard shortcuts" }).click();
  await list.getByRole("switch", { name: "Single-key shortcuts" }).click();
  await ada.keyboard.press("Escape");
  await ada.keyboard.press("c");
  await expect(newIssue).toBeVisible();
});

test("the light theme is kept across a reload", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const dark = () => ada.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(await dark()).toBe(true);
  await ada.keyboard.press("ControlOrMeta+k");
  await palette(ada).getByRole("combobox").fill("light");
  await palette(ada).getByRole("option", { name: "Light theme" }).click();
  expect(await dark()).toBe(false);
  await ada.reload();
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
  expect(await dark()).toBe(false);
});

import { blur, createIssue, description, heading, newProject, openIssue, paste, peek, row } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

/** Keys pressed, among text typed. */
const KEYS = new Set(["Enter", "ArrowDown"]);

test("every mark and block typed as Markdown is formatted, and is the same after a reload", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Round");
  const text = description(ada);
  await text.click();
  const lines = async (...keys: string[]) => {
    for (const key of keys) await (KEYS.has(key) ? ada.keyboard.press(key) : ada.keyboard.type(key));
  };
  await lines("# Title", "Enter", "## Steps", "Enter", "### Notes", "Enter");
  await lines("- milk", "Enter", "Enter");
  await lines("1. Open", "Enter", "Click", "Enter", "Enter");
  await lines("[ ] verify", "Enter", "Enter");
  await lines("> quoted", "Enter", "Enter");
  await lines("```ts ", "const answer = 42;", "ArrowDown");
  await lines("---");
  await lines("**bold** *italic* ~~strike~~ `code` https://example.com/docs ", "Enter");
  await lines("/tab", "Enter");
  await ada.keyboard.type("Browser");

  const formatted = async () => {
    await expect(text.getByRole("heading", { level: 1, name: "Title" })).toBeVisible();
    await expect(text.getByRole("heading", { level: 2, name: "Steps" })).toBeVisible();
    await expect(text.getByRole("heading", { level: 3, name: "Notes" })).toBeVisible();
    await expect(text.locator("ul:not([data-type]) > li")).toHaveText("milk");
    await expect(text.locator("ol > li")).toHaveText(["Open", "Click"]);
    await expect(text.getByRole("checkbox", { name: "verify" })).not.toBeChecked();
    await expect(text.locator("blockquote")).toHaveText("quoted");
    await expect(text.locator("pre code.language-ts")).toHaveText("const answer = 42;");
    // Highlighted in the language named on the fence.
    await expect(text.locator("pre .hljs-keyword")).toHaveText("const");
    await expect(text.locator("hr")).toHaveCount(1);
    await expect(text.locator("strong")).toHaveText("bold");
    await expect(text.locator("em")).toHaveText("italic");
    await expect(text.locator("s")).toHaveText("strike");
    await expect(text.locator("p > code")).toHaveText("code");
    await expect(text.getByRole("link", { name: "https://example.com/docs" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
    await expect(text.getByRole("row")).toHaveCount(3);
    await expect(text.getByRole("columnheader")).toHaveText(["Browser", "", ""]);
  };
  await formatted();
  await blur(ada);
  await expect(ada.getByTestId("activity").filter({ hasText: "updated the description" })).toHaveCount(1);
  await ada.reload();
  await formatted();
});

test("a list is typed with '- ', and ⌘B makes the selection bold", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Keys");
  const text = description(ada);
  await text.click();
  await ada.keyboard.type("- milk");
  await expect(text.getByRole("listitem")).toHaveText("milk");
  await ada.keyboard.press("ControlOrMeta+a");
  await ada.keyboard.press("ControlOrMeta+b");
  await expect(text.locator("strong")).toHaveText("milk");
});

test("a to-do item checked in a description stays checked after a reload", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Todo");
  const text = description(ada);
  await text.click();
  await ada.keyboard.type("[ ] ship it");
  await blur(ada);
  await text.getByRole("checkbox", { name: "ship it" }).click();
  await expect(text.getByRole("checkbox", { name: "ship it" })).toBeChecked();
  await blur(ada);
  await expect(ada.getByTestId("activity").filter({ hasText: "updated the description" })).toHaveCount(2);
  await ada.reload();
  await expect(text.getByRole("checkbox", { name: "ship it" })).toBeChecked();
});

test("the slash menu inserts a table, and Escape or no match leaves the typed text", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Slash");
  const text = description(ada);
  const menu = ada.getByRole("listbox", { name: "Insert block" });
  await text.click();
  await ada.keyboard.type("/");
  await expect(menu.getByRole("option")).toHaveText([
    "Text",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Bulleted list",
    "Numbered list",
    "To-do list",
    "Quote",
    "Code block",
    "Table",
    "Divider",
  ]);
  await ada.keyboard.type("tab");
  await expect(menu.getByRole("option")).toHaveText(["Table"]);
  await ada.keyboard.press("Enter");
  await expect(text.getByRole("row")).toHaveCount(3);
  await expect(text.getByRole("columnheader")).toHaveCount(3);
  await expect(text).not.toContainText("/tab");

  // Out of the table, into the paragraph after it.
  await ada.keyboard.press("ControlOrMeta+End");
  await ada.keyboard.type("/hea");
  await expect(menu.getByRole("option")).toHaveCount(3);
  await ada.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(text).toContainText("/hea");
  await ada.keyboard.type(" /zzz");
  await expect(menu).toHaveCount(0);
  await expect(text).toContainText("/hea /zzz");

  await ada.keyboard.press("Enter");
  await ada.keyboard.type("/");
  await ada.keyboard.press("ArrowDown");
  await ada.keyboard.press("ArrowDown");
  await ada.keyboard.press("Enter");
  await ada.keyboard.type("Chosen by arrow");
  await expect(text.getByRole("heading", { level: 2, name: "Chosen by arrow" })).toBeVisible();
});

test("the toolbar formats the selection, and the table menu adds a row", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Toolbar");
  const text = description(ada);
  const tools = ada.getByRole("toolbar", { name: "Formatting" });
  await text.click();
  await expect(tools).toHaveCount(0);
  await ada.keyboard.type("make me bold");
  await ada.keyboard.press("ControlOrMeta+a");
  await expect(tools.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
  await tools.getByRole("button", { name: "Bold" }).click();
  await expect(text.locator("strong")).toHaveText("make me bold");
  await expect(tools.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
  await tools.getByRole("button", { name: "Quote" }).click();
  await expect(text.locator("blockquote strong")).toHaveText("make me bold");

  await ada.keyboard.press("ControlOrMeta+End");
  await ada.keyboard.press("Enter");
  await ada.keyboard.press("Enter");
  await ada.keyboard.type("/table");
  await ada.keyboard.press("Enter");
  await expect(text.getByRole("row")).toHaveCount(3);
  await ada.getByRole("toolbar", { name: "Table" }).getByRole("button", { name: "Add row below" }).click();
  await expect(text.getByRole("row")).toHaveCount(4);
  await ada.getByRole("toolbar", { name: "Table" }).getByRole("button", { name: "Delete table" }).click();
  await expect(text.getByRole("table")).toHaveCount(0);
});

test("a pasted URL links the selection, and only web and mail addresses become links", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Links");
  const text = description(ada);
  const tools = ada.getByRole("toolbar", { name: "Formatting" });
  await text.click();
  await ada.keyboard.type("the docs");
  await ada.keyboard.press("ControlOrMeta+a");
  await paste(text, "https://example.com/docs");
  const link = text.getByRole("link", { name: "the docs" });
  await expect(link).toHaveAttribute("href", "https://example.com/docs");
  await expect(link).toHaveAttribute("target", "_blank");

  // An empty address removes the link.
  await ada.keyboard.press("ControlOrMeta+a");
  await tools.getByRole("button", { name: "Link" }).click();
  const address = ada.getByLabel("Link address");
  await expect(address).toHaveValue("https://example.com/docs");
  await address.fill("");
  await address.press("Enter");
  await expect(text.getByRole("link")).toHaveCount(0);

  await ada.keyboard.press("ControlOrMeta+a");
  await tools.getByRole("button", { name: "Link" }).click();
  await address.fill("javascript:alert(1)");
  await address.press("Enter");
  await expect(ada.getByText("Web or mail addresses only")).toBeVisible();
  await expect(text.getByRole("link")).toHaveCount(0);
  await address.fill("example.com/guide");
  await address.press("Enter");
  await expect(text.getByRole("link", { name: "the docs" })).toHaveAttribute("href", "https://example.com/guide");
});

test("pasted Markdown goes in formatted, and into a code block unchanged", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Paste");
  const text = description(ada);
  await text.click();
  await paste(text, "## Steps\n\n1. Open\n2. Click");
  await expect(text.getByRole("heading", { level: 2, name: "Steps" })).toBeVisible();
  await expect(text.locator("ol > li")).toHaveText(["Open", "Click"]);

  await ada.keyboard.press("ControlOrMeta+End");
  await ada.keyboard.press("Enter");
  await ada.keyboard.press("Enter");
  await ada.keyboard.type("``` ");
  await paste(text, "## not a heading");
  await expect(text.locator("pre code")).toHaveText("## not a heading");
  await expect(text.getByRole("heading")).toHaveCount(1);
});

test("a description saves on blur for every member, and one undo restores it", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  await openIssue(ada, "Blur");
  await bob.goto(ada.url());
  await expect(description(bob)).toBeVisible();

  await description(ada).click();
  await ada.keyboard.type("[ ] first draft");
  await expect(description(bob).getByRole("checkbox")).toHaveCount(0);
  await blur(ada);
  await expect(description(bob).getByRole("checkbox", { name: "first draft" })).toBeVisible();

  await ada.keyboard.press("ControlOrMeta+z");
  await expect(description(bob).getByRole("checkbox")).toHaveCount(0);
  await expect(description(ada).getByRole("checkbox")).toHaveCount(0);
});

test("a description follows another member's save, but not while it is being edited", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  await openIssue(ada, "Follow");
  await bob.goto(ada.url());
  await expect(description(bob)).toBeVisible();

  await description(bob).click();
  await bob.keyboard.type("From Bob");
  await blur(bob);
  await expect(description(ada)).toHaveText("From Bob");

  await description(ada).click();
  await ada.keyboard.press("ControlOrMeta+End");
  await ada.keyboard.type(", and Ada is typing");
  await description(bob).click();
  await bob.keyboard.press("ControlOrMeta+a");
  await bob.keyboard.type("Bob again");
  await blur(bob);
  await expect(bob.getByTestId("activity").filter({ hasText: "updated the description" })).toHaveCount(2);
  await expect(description(ada)).toHaveText("From Bob, and Ada is typing");

  // Her save wins.
  await blur(ada);
  await expect(description(bob)).toHaveText("From Bob, and Ada is typing");
});

test("the new-issue dialog takes a formatted description, and ⌘Enter in it creates the issue once", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Dialog");
  const title = `Dialog ${Date.now()}`;
  await ada.keyboard.press("c");
  const dialog = ada.getByRole("dialog", { name: "New issue" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Description").click();
  await ada.keyboard.type("[ ] from the dialog");
  await ada.keyboard.press("ControlOrMeta+Enter");
  await expect(dialog).toHaveCount(0);
  await expect(row(ada, title)).toHaveCount(1);
  const panel = await peek(ada, title);
  await expect(panel.getByLabel("Description").getByRole("checkbox", { name: "from the dialog" })).toBeVisible();
});

test("comments are formatted, blank ones cannot be sent, and an edit can be cancelled", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  await openIssue(ada, "Talk");
  await bob.goto(ada.url());
  const box = ada.getByLabel("Comment", { exact: true });
  const send = ada.getByRole("button", { name: "Comment", exact: true });
  const comments = ada.getByTestId("comment");

  await expect(send).toBeDisabled();
  await box.click();
  await ada.keyboard.type("- ");
  await expect(box.getByRole("listitem")).toHaveCount(1);
  await expect(send).toBeDisabled();
  await ada.keyboard.press("ControlOrMeta+Enter");
  await expect(box.getByRole("listitem")).toHaveCount(1);
  await expect(comments).toHaveCount(0);

  await ada.keyboard.type("check `retry()` first");
  await expect(send).toBeEnabled();
  await ada.keyboard.press("ControlOrMeta+Enter");
  await expect(comments).toHaveCount(1);
  await expect(box).toHaveText("");
  for (const page of [ada, bob]) {
    const comment = page.getByTestId("comment");
    await expect(comment.getByRole("listitem")).toHaveText("check retry() first");
    await expect(comment.locator("code")).toHaveText("retry()");
  }

  await comments.getByRole("button", { name: "Comment actions" }).click();
  await ada.getByRole("menuitem", { name: "Edit" }).click();
  const editor = ada.getByLabel("Edit comment");
  await expect(editor.locator("code")).toHaveText("retry()");
  await expect(editor).toBeFocused();
  await ada.keyboard.type(" and more");
  await comments.getByRole("button", { name: "Cancel" }).click();
  await expect(editor).toHaveCount(0);
  await expect(comments.getByRole("listitem")).toHaveText("check retry() first");
  await expect(comments).not.toContainText("(edited)");

  await comments.getByRole("button", { name: "Comment actions" }).click();
  await ada.getByRole("menuitem", { name: "Edit" }).click();
  await editor.click();
  await ada.keyboard.press("ControlOrMeta+End");
  await ada.keyboard.type(", **then** ship");
  await comments.getByRole("button", { name: "Save" }).click();
  await expect(bob.getByTestId("comment").locator("strong")).toHaveText("then");
  await expect(bob.getByTestId("comment")).toContainText("(edited)");
});

test("HTML typed into a comment is shown as text and never runs", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Inert");
  await ada.getByLabel("Comment", { exact: true }).click();
  await ada.keyboard.type('<img src=x onerror="window.pwned=1">');
  await ada.keyboard.press("ControlOrMeta+Enter");
  const comment = ada.getByTestId("comment");
  await expect(comment).toContainText('<img src=x onerror="window.pwned=1">');
  await ada.reload();
  await expect(comment).toContainText('<img src=x onerror="window.pwned=1">');
  await expect(comment.locator("img")).toHaveCount(0);
  expect(await ada.evaluate(() => "pwned" in window)).toBe(false);
});

test("an archived issue's description and comments are formatted and read-only", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Shelf");
  const title = `Shelved ${Date.now()}`;
  await createIssue(ada, title);
  await row(ada, title).click({ button: "right" });
  await ada.getByRole("menuitem", { name: "State" }).click();
  await ada.getByRole("menuitemradio", { name: "Done" }).click();
  const panel = await peek(ada, title);
  await panel.getByRole("link", { name: "Open issue page" }).click();
  await expect(ada).toHaveURL(/\/issues\/[\w-]+$/);
  // The address changes before the issue's page has replaced the list's heading.
  await expect(heading(ada)).toHaveText(/^[A-Z0-9]+-\d+$/);
  const key = await heading(ada).textContent();
  const text = description(ada);

  await ada.getByRole("button", { name: `${key} actions` }).click();
  await ada.getByRole("menuitem", { name: /^Archive/ }).click();
  await expect(text).toHaveAttribute("contenteditable", "false");
  await expect(text.locator("p")).toHaveAttribute("data-placeholder", "No description");

  await ada.getByRole("status").filter({ hasText: "This issue is archived" }).getByRole("button").click();
  await expect(text).toHaveAttribute("contenteditable", "true");
  await text.click();
  await ada.keyboard.type("[ ] shelved task");
  await blur(ada);
  await ada.getByLabel("Comment", { exact: true }).click();
  await ada.keyboard.type("a **bold** remark");
  await ada.keyboard.press("ControlOrMeta+Enter");
  await expect(ada.getByTestId("comment").locator("strong")).toHaveText("bold");

  await ada.getByRole("button", { name: `${key} actions` }).click();
  await ada.getByRole("menuitem", { name: /^Archive/ }).click();
  await expect(text).toHaveAttribute("contenteditable", "false");
  const box = text.getByRole("checkbox", { name: "shelved task" });
  await expect(box).toBeVisible();
  await box.click({ force: true });
  await expect(box).not.toBeChecked();
  await text.locator("p").first().selectText();
  await expect(ada.getByRole("toolbar", { name: "Formatting" })).toHaveCount(0);
  await expect(ada.getByTestId("comment").locator("strong")).toHaveText("bold");
  await expect(ada.getByLabel("Comment", { exact: true })).toHaveCount(0);
});

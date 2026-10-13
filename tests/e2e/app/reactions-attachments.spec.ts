import type { Locator, Page } from "@playwright/test";
import { blur, description, openIssue } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const composer = (page: Page) => page.getByLabel("Comment", { exact: true });
const attachments = (page: Page) => page.getByRole("list", { name: "Attachments" });
/** The reactions to the issue itself; a comment's are inside the comment. */
const issueReactions = (page: Page) => page.getByRole("group", { name: "Reactions" }).first();

async function react(group: Locator, emoji: string) {
  await group.getByRole("button", { name: "Add reaction" }).click();
  await group.page().getByRole("menuitem", { name: emoji }).click();
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByLabel("Title")).toBeVisible();
}

const chooseFile = (page: Page, name: string, buffer: Buffer, mimeType = "application/octet-stream") =>
  page.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });

/** Pastes or drops a file onto an editor, as the clipboard or a drag from the desktop does. */
const give = (editor: Locator, how: "paste" | "drop", name: string, bytes: Buffer, type: string) =>
  editor.evaluate(
    (element, file) => {
      const data = new DataTransfer();
      data.items.add(new File([Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))], file.name, file));
      const box = element.getBoundingClientRect();
      const init = { bubbles: true, cancelable: true, clientX: box.left + 8, clientY: box.top + 8 };
      element.dispatchEvent(
        file.how === "paste"
          ? new ClipboardEvent("paste", { ...init, clipboardData: data })
          : new DragEvent("drop", { ...init, dataTransfer: data }),
      );
    },
    { how, name, type, base64: bytes.toString("base64") },
  );

test("members react to an issue and a comment, see each other's reactions, and undo one", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Xenon");
  const bob = await signIn(browser, "bob");
  await open(bob, ada.url());

  await react(issueReactions(ada), "👍");
  const thumb = issueReactions(ada).getByRole("button", { name: /^👍 1: Ada/ });
  await expect(thumb).toHaveAttribute("aria-pressed", "true");
  await expect(issueReactions(bob).getByRole("button", { name: /^👍 1: Ada/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await issueReactions(bob).getByRole("button", { name: /^👍 1/ }).click();
  await expect(issueReactions(ada).getByRole("button", { name: /^👍 2: Ada.*, Bob/ })).toBeVisible();

  await composer(ada).click();
  await ada.keyboard.type("Shipping today");
  await ada.keyboard.press("ControlOrMeta+Enter");
  await react(bob.getByTestId("comment").getByRole("group", { name: "Reactions" }), "🎉");
  const party = ada.getByTestId("comment").getByRole("button", { name: /^🎉 1: Bob/ });
  await expect(party).toHaveAttribute("aria-pressed", "false");

  await thumb.or(issueReactions(ada).getByRole("button", { name: /^👍/ })).click();
  await expect(issueReactions(bob).getByRole("button", { name: /^👍 1: Bob/ })).toBeVisible();
  await expect(issueReactions(ada).getByRole("button", { name: /^👍 1: Bob/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await react(issueReactions(ada), "👀");
  await expect(issueReactions(bob).getByRole("button", { name: /^👀 1/ })).toBeVisible();
  await blur(ada);
  await ada.keyboard.press("ControlOrMeta+z");
  await expect(issueReactions(bob).getByRole("button", { name: /^👀/ })).toHaveCount(0);

  await ada.reload();
  await expect(issueReactions(ada).getByRole("button", { name: /^👍 1: Bob/ })).toBeVisible();
  await expect(party).toBeVisible();
});

test("a file is attached from the widgets, downloaded, and removed by its uploader or an admin", async ({
  browser,
}) => {
  const cy = await signIn(browser, "cy");
  await openIssue(cy, "Yarn");
  const ada = await signIn(browser, "ada");
  await open(ada, cy.url());
  const bob = await signIn(browser, "bob");
  await open(bob, cy.url());

  await expect(cy.getByRole("button", { name: "Attach file" })).toBeVisible();
  await chooseFile(cy, "notes.txt", Buffer.from("hello"), "text/plain");
  const item = (page: Page) => attachments(page).getByRole("listitem").filter({ hasText: "notes.txt" });
  await expect(item(cy)).toContainText("5 B");
  await expect(item(cy)).toContainText("Cy");
  await expect(item(ada)).toContainText("5 B");

  const href = await item(ada).getByRole("link", { name: "notes.txt" }).getAttribute("href");
  const file = await ada.request.get(href!);
  expect(await file.text()).toBe("hello");
  expect(file.headers()["content-disposition"]).toBe("attachment; filename*=UTF-8''notes.txt");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");

  // Cy uploaded it; Ada owns the workspace and Bob is an admin.
  await chooseFile(ada, "plan.txt", Buffer.from("plan"), "text/plain");
  const plan = (page: Page) => attachments(page).getByRole("listitem").filter({ hasText: "plan.txt" });
  await expect(plan(cy)).toBeVisible();
  await expect(plan(cy).getByRole("button", { name: "Remove attachment plan.txt" })).toHaveCount(0);
  await bob.getByRole("button", { name: "Remove attachment notes.txt" }).click();
  await expect(item(cy)).toHaveCount(0);
  await expect(item(ada)).toHaveCount(0);
  expect((await ada.request.get(href!)).status()).toBe(404);

  await blur(bob);
  await bob.keyboard.press("ControlOrMeta+z");
  await expect(item(cy)).toBeVisible();
  expect(await (await ada.request.get(href!)).text()).toBe("hello");
});

test("a pasted image shows in a comment, and a dropped file is a link in the description", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Xylo");

  await composer(ada).click();
  await ada.keyboard.type("Look: ");
  await give(composer(ada), "paste", "shot.png", PNG, "image/png");
  await expect(composer(ada).locator("img[src]")).toHaveAttribute("alt", "shot.png");
  await ada.keyboard.press("ControlOrMeta+Enter");
  const shown = ada.getByTestId("comment").locator("img[src]");
  const loaded = () => shown.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth);
  await expect.poll(loaded).toBe(1);
  await expect(attachments(ada).getByRole("link", { name: "shot.png" })).toBeVisible();

  await description(ada).click();
  await give(description(ada), "drop", "report.pdf", Buffer.from("%PDF-1.4"), "application/pdf");
  const link = description(ada).getByRole("link", { name: "report.pdf" });
  await expect(link).toHaveAttribute("href", /^\/api\/w\/[\w-]+\/files\/[0-9a-f-]{36}$/);
  // An SVG is a file like any other: a browser would run it as an image of the app.
  await give(description(ada), "paste", "logo.svg", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "");
  await expect(description(ada).getByRole("link", { name: "logo.svg" })).toBeVisible();
  await expect(description(ada).locator("img[src]")).toHaveCount(0);
  await blur(ada);
  await expect(attachments(ada).getByRole("listitem")).toHaveCount(3);
  const svg = await ada.request.get(
    (await attachments(ada).getByRole("link", { name: "logo.svg" }).getAttribute("href"))!,
  );
  expect(svg.headers()["content-type"]).toBe("application/octet-stream");
  expect(svg.headers()["content-disposition"]).toMatch(/^attachment;/);

  await ada.reload();
  await expect.poll(loaded).toBe(1);
  await expect(link).toBeVisible();
  await expect(attachments(ada).getByRole("listitem")).toHaveCount(3);
});

test("an image from elsewhere is a link, a workspace's own image is shown, and one whose file is gone is its name", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Xeric");
  await chooseFile(ada, "own.png", PNG, "image/png");
  const href = (await attachments(ada).getByRole("link", { name: "own.png" }).getAttribute("href"))!;
  const elsewhere: string[] = [];
  ada.on("request", (request) => {
    if (request.url().includes("example.com")) elsewhere.push(request.url());
  });

  // Written through the API, as text the editor did not make.
  const id = new URL(ada.url()).pathname.split("/").at(-1)!;
  const gone = href.replace(/[^/]+$/, crypto.randomUUID());
  const text = `![pixel](https://example.com/pixel.png)\n\n![x](javascript:alert(1))\n\n![own](${href})\n\n![old.png](${gone})`;
  const saved = await ada.request.post(href.replace(/\/files\/.*/, "/transactions"), {
    data: {
      id: crypto.randomUUID(),
      mutations: [{ model: "Issue", type: "update", key: id, value: { description: text } }],
    },
  });
  expect(saved.ok()).toBe(true);

  await expect(description(ada).getByRole("link", { name: "pixel" })).toHaveAttribute(
    "href",
    "https://example.com/pixel.png",
  );
  await expect(description(ada).getByText("old.png (unavailable)")).toBeVisible();
  await expect(description(ada).locator("img[src]")).toHaveCount(1);
  await expect(description(ada).locator("img[src]")).toHaveAttribute("src", href);
  await expect(description(ada).getByRole("link")).toHaveCount(1);
  await expect(description(ada)).toContainText("x");
  expect(elsewhere).toEqual([]);
});

test("files dropped on the widgets are attached, and one the text shows is removed only after asking", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Xyst");
  await description(ada).click();
  await give(description(ada), "paste", "shot.png", PNG, "image/png");
  await expect(description(ada).locator("img[src]")).toHaveAttribute("alt", "shot.png");
  await blur(ada);
  // A path and a mark that turns the text around are not part of the name it is attached under.
  await give(ada.getByRole("button", { name: "Attach file" }).first(), "drop", "C:\\tmp\\no\u202etes.txt", PNG, "");
  const file = (name: string) => attachments(ada).getByRole("link", { name, exact: true });
  await expect(file("notes.txt")).toBeVisible();
  await expect(file("shot.png")).toBeVisible();

  await ada.getByRole("button", { name: "Remove attachment notes.txt" }).click();
  await expect(file("notes.txt")).toHaveCount(0);
  await ada.getByRole("button", { name: "Remove attachment shot.png" }).click();
  const asking = ada.getByRole("dialog", { name: "Remove shot.png?" });
  await asking.getByRole("button", { name: "Cancel" }).click();
  await expect(file("shot.png")).toBeVisible();
  await ada.getByRole("button", { name: "Remove attachment shot.png" }).click();
  await asking.getByRole("button", { name: "Remove" }).click();
  await expect(attachments(ada)).toHaveCount(0);
});

test("a file over 10 MB is refused before it is sent, and nothing is attached offline", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openIssue(ada, "Xebec");
  await chooseFile(ada, "huge.bin", Buffer.alloc(10 * 1024 * 1024 + 1));
  await expect(ada.getByText("huge.bin is too large: a file is at most 10 MB")).toBeVisible();

  await ada.context().setOffline(true);
  await chooseFile(ada, "notes.txt", Buffer.from("hello"), "text/plain");
  await expect(ada.getByText("Files can only be attached while online")).toBeVisible();
  await ada.context().setOffline(false);
  await expect(ada.getByTestId("sync-status")).toHaveText("Live");
  await expect(attachments(ada)).toHaveCount(0);
});

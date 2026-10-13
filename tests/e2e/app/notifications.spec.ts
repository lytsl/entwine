import type { Locator, Page } from "@playwright/test";
import { blur, createAndOpen, description, heading, newProject, paste, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

/** The sidebar's count; other specs notify in the same workspace, so tests compare it with what it was. */
async function unread(page: Page): Promise<number> {
  const badge = sidebar(page).getByTestId("unread-count");
  return (await badge.count()) ? Number(await badge.textContent()) : 0;
}

const notification = (page: Page, title: string): Locator =>
  page.getByRole("list", { name: "Notifications" }).getByRole("listitem").filter({ hasText: title });

test("a mention from the menu is a chip, is stored readable, notifies its member live and follows a rename", async ({
  browser,
}) => {
  test.slow();
  const ada = await signIn(browser, "ada");
  const cy = await signIn(browser, "cy");
  await newProject(ada, "Zed");
  const title = `Mentioned ${Date.now()}`;
  await createAndOpen(ada, title);
  const before = await unread(cy);

  const composer = ada.getByLabel("Comment", { exact: true });
  await composer.click();
  await ada.keyboard.type("@zzz then ");
  await expect(ada.getByRole("listbox", { name: "Mention a member" })).toHaveCount(0);
  await ada.keyboard.type("ask @c");
  const menu = ada.getByRole("listbox", { name: "Mention a member" });
  await expect(menu.getByRole("option", { name: "Cy" })).toHaveAttribute("aria-selected", "true");
  await ada.keyboard.press("Enter");
  await ada.keyboard.type("please");
  await expect(composer.locator(".mention")).toHaveText("@Cy");
  const sent = ada.waitForRequest((request) => request.url().endsWith("/transactions") && request.method() === "POST");
  await ada.keyboard.press("ControlOrMeta+Enter");
  const body = (await sent).postDataJSON().mutations[0].value.body as string;
  expect(body).toMatch(/^@zzz then ask \[@Cy\]\(mention:[\w-]+\) please$/);

  const comment = ada.getByTestId("comment").filter({ hasText: "please" });
  await expect(comment.locator(".mention")).toHaveText("@Cy");
  await expect(comment.getByRole("link")).toHaveCount(0);

  await expect.poll(() => unread(cy)).toBe(before + 1);
  await sidebar(cy).getByRole("link", { name: "Inbox" }).click();
  await expect(heading(cy)).toHaveText("Inbox");
  const row = notification(cy, title);
  await expect(row).toContainText("Ada mentioned you");
  await expect(row.getByRole("img", { name: "Unread" })).toBeVisible();
  await cy.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "Mentions" }).click();
  await expect(row).toBeVisible();
  await expect(cy.getByRole("list", { name: "Notifications" }).getByRole("listitem")).toHaveText(
    Array.from(
      { length: await cy.getByRole("list", { name: "Notifications" }).getByRole("listitem").count() },
      () => /mentioned you/,
    ),
  );

  await row.getByRole("link").click();
  await expect(cy.getByLabel("Title")).toHaveValue(title);
  await expect.poll(() => unread(cy)).toBe(before);
  await expect(cy.getByTestId("comment").locator(".mention")).toHaveText("@Cy");

  const rename = (name: string) =>
    cy.evaluate(
      (name) =>
        fetch("/api/auth/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }).then((response) => response.ok),
      name,
    );
  expect(await rename("Cyrus")).toBe(true);
  try {
    await cy.reload();
    await expect(ada.getByTestId("comment").locator(".mention")).toHaveText("@Cyrus");
  } finally {
    await rename("Cy");
  }
  await cy.reload();
  await ada.reload();
  await expect(ada.getByTestId("comment").locator(".mention")).toHaveText("@Cy");
});

test("the inbox marks one and all read and unread, and the issue's page subscribes and unsubscribes", async ({
  browser,
}) => {
  test.slow();
  const ada = await signIn(browser, "ada");
  const cy = await signIn(browser, "cy");
  await newProject(ada, "Zeta");
  const title = `Followed ${Date.now()}`;
  await createAndOpen(ada, title);
  const subscribers = (page: Page) => page.getByRole("region", { name: "Subscribers" });
  await expect(subscribers(ada).getByRole("listitem")).toHaveText([/Ada$/]);

  await cy.goto(new URL(ada.url()).pathname);
  await expect(cy.getByLabel("Title")).toHaveValue(title);
  await subscribers(cy).getByRole("button", { name: "Subscribe" }).click();
  await expect(subscribers(ada).getByRole("listitem")).toHaveText([/Ada$/, /Cy$/]);
  await sidebar(cy).getByRole("link", { name: "Inbox" }).click();
  await expect(heading(cy)).toHaveText("Inbox");
  const before = await unread(cy);

  const composer = ada.getByLabel("Comment", { exact: true });
  await composer.click();
  await ada.keyboard.type("An update");
  await ada.keyboard.press("ControlOrMeta+Enter");
  const row = notification(cy, title);
  await expect(row).toContainText("Ada commented");
  await expect.poll(() => unread(cy)).toBe(before + 1);

  await row.getByRole("button", { name: "Mark as read" }).click();
  await expect(row.getByRole("img", { name: "Unread" })).toHaveCount(0);
  await expect.poll(() => unread(cy)).toBe(before);
  await row.getByRole("button", { name: "Mark as unread" }).click();
  await expect.poll(() => unread(cy)).toBe(before + 1);

  await cy
    .getByRole("radiogroup", { name: "Show" })
    .getByRole("radio", { name: /Unread/ })
    .click();
  await expect(row).toBeVisible();
  await cy.getByRole("button", { name: "Mark all as read" }).click();
  await expect(sidebar(cy).getByTestId("unread-count")).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await cy.getByRole("radiogroup", { name: "Show" }).getByRole("radio", { name: "All" }).click();
  await expect(row.getByRole("img", { name: "Unread" })).toHaveCount(0);

  // Two more comments are two notifications, and opening either reads both: the issue shows what both are about.
  for (const text of ["A second update", "A third update"]) {
    await composer.click();
    await ada.keyboard.type(text);
    await ada.keyboard.press("ControlOrMeta+Enter");
  }
  await expect(row.getByRole("img", { name: "Unread" })).toHaveCount(2);
  await expect.poll(() => unread(cy)).toBe(2);
  await row.first().getByRole("link").click();
  await expect(cy.getByLabel("Title")).toHaveValue(title);
  await expect(sidebar(cy).getByTestId("unread-count")).toHaveCount(0);

  await subscribers(cy).getByRole("button", { name: "Unsubscribe" }).click();
  await expect(subscribers(ada).getByRole("listitem")).toHaveText([/Ada$/]);
  await composer.click();
  await ada.keyboard.type("Another update");
  await ada.keyboard.press("ControlOrMeta+Enter");
  await expect(cy.getByTestId("comment").filter({ hasText: "Another update" })).toBeVisible();
  await expect(sidebar(cy).getByTestId("unread-count")).toHaveCount(0);
});

test("a mention address is nowhere to go, and a mention of nobody shows its stored name", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Zinc");
  await createAndOpen(ada, `Inert ${Date.now()}`);
  const text = description(ada);
  await text.click();
  await paste(text, "See [click](mention:x) and **ask** [@Ghost](mention:nobody) today");
  await blur(ada);
  await ada.reload();
  await expect(text).toContainText("today");
  await expect(text.locator(".mention")).toHaveText(["@Ghost"]);
  await expect(text).toContainText("click");
  // Neither is a link to the address: the chip is no link at all, and the other text's address was refused.
  await expect(text.locator(".mention a, a.mention")).toHaveCount(0);
  await expect(text.locator('a[href*="mention"]')).toHaveCount(0);
  // A refused address leaves the text, and no link to the page itself.
  await expect(text.getByRole("link")).toHaveCount(0);
  await expect(text.locator("a")).toHaveCount(0);
});

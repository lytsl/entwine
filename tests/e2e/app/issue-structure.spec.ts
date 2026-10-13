import { choose, createAndOpen, openProject } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("a sub-issue created on its parent's page shows for every member, with the parent's progress", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  const parent = `Launch ${Date.now()}`;
  await createAndOpen(ada, parent);
  await ada.getByRole("button", { name: "Add sub-issue" }).click();
  await ada.getByRole("menuitem", { name: "New sub-issue" }).click();
  await ada.getByLabel("Sub-issue title").fill("Write the changelog");
  await ada.getByLabel("Sub-issue title").press("Enter");
  await choose(ada, ada.getByLabel("Estimate: No estimate"), "5 points");

  const bob = await signIn(browser, "bob");
  await bob.goto(ada.url());
  const children = bob.getByRole("list", { name: "Sub-issues" });
  await expect(children.getByRole("link", { name: "Write the changelog" })).toBeVisible();
  await expect(bob.getByText("0 of 1 done")).toBeVisible();
  await expect(bob.getByLabel("Estimate: 5 points")).toBeVisible();
  await children.getByRole("link", { name: "Write the changelog" }).click();
  await expect(bob.getByRole("link", { name: new RegExp(`Sub-issue of WEB-\\d+ ${parent}`) })).toBeVisible();
});

test("a relation shows on both issues, from each side, and either member can remove it", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  const stamp = Date.now();
  const blockerKey = await createAndOpen(ada, `Blocker ${stamp}`);
  const blockerUrl = ada.url();
  await openProject(ada, "Website");
  await createAndOpen(ada, `Blocked ${stamp}`);
  const blockedUrl = ada.url();

  await ada.goto(blockerUrl);
  await ada.getByRole("button", { name: "Add relation" }).click();
  await ada.getByRole("menuitem", { name: "Blocks" }).click();
  await ada.getByRole("dialog").getByRole("combobox").fill(`Blocked ${stamp}`);
  await ada.getByRole("option", { name: new RegExp(`Blocked ${stamp}`) }).click();
  await expect(ada.getByRole("list", { name: "Blocks" }).getByText(`Blocked ${stamp}`)).toBeVisible();

  const bob = await signIn(browser, "bob");
  await bob.goto(blockedUrl);
  await expect(bob.getByRole("list", { name: "Blocked by" }).getByText(`Blocker ${stamp}`)).toBeVisible();
  await expect(
    bob.getByTestId("activity").filter({ hasText: `marked this issue as blocked by ${blockerKey}` }),
  ).toBeVisible();
  await bob.getByRole("button", { name: `Remove relation to ${blockerKey}` }).click();
  await expect(ada.getByRole("list", { name: "Blocks" })).toHaveCount(0);
});

test("links are http addresses that every member sees and can open", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await createAndOpen(ada, `Linked ${Date.now()}`);
  await ada.getByRole("button", { name: "Add link" }).click();
  const links = ada.getByRole("region", { name: "Links" });
  await ada.getByLabel("URL").fill("not a url");
  await links.getByRole("button", { name: "Add link" }).last().click();
  await expect(links.getByText("Use an http or https address")).toBeVisible();
  await ada.getByLabel("URL").fill("https://example.com/spec");
  await ada.getByLabel("Link title").fill("Spec");
  await links.getByRole("button", { name: "Add link" }).last().click();

  const cy = await signIn(browser, "cy");
  await cy.goto(ada.url());
  const link = cy.getByRole("list", { name: "Links" }).getByRole("link", { name: "Spec" });
  await expect(link).toHaveAttribute("href", "https://example.com/spec");
  await expect(link).toHaveAttribute("target", "_blank");
  await cy.getByRole("button", { name: "Remove link Spec" }).click();
  await expect(ada.getByRole("list", { name: "Links" })).toHaveCount(0);
});

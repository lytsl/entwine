import { choose, createIssue, newProject, row } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("a closing property popup does not swallow the next undo shortcut", async ({ browser }, testInfo) => {
  const page = await signIn(browser, "ada");
  await newProject(page, "Closing");
  const title = `Closing ${crypto.randomUUID()}`;
  await createIssue(page, title);
  await choose(page, row(page, title).getByLabel("Priority: No priority"), "High");
  await expect(row(page, title).getByLabel("Priority: High")).toBeVisible();
  const inputState = await page.evaluate(() => ({
    active: document.activeElement?.tagName,
    popups: [...document.querySelectorAll("[data-slot=popover-content]")].map((el) => ({
      closed: el.hasAttribute("data-closed"),
      role: el.getAttribute("role"),
    })),
  }));
  await testInfo.attach("input-state", { body: JSON.stringify(inputState), contentType: "application/json" });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(row(page, title).getByLabel("Priority: No priority")).toBeVisible();
});

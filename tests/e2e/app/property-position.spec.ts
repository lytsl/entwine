import { createIssue, newProject, peek, row } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("property popups stay anchored to their row controls", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  await newProject(page, "Anchors");
  const title = `Anchored ${crypto.randomUUID()}`;
  await createIssue(page, title);
  const panel = await peek(page, title);
  await panel.getByLabel("Due date: none").click();
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  await page.getByRole("button", { name: new RegExp(`${month} 10(st|nd|rd|th)`) }).click();
  await expect(panel.getByLabel(/^Due date:/)).not.toHaveAccessibleName("Due date: none");
  await panel.getByRole("button", { name: "Close preview" }).click();
  const issue = row(page, title);

  for (const name of [/^Assignee:/, /^Priority:/, /^Due date:/]) {
    const trigger = issue.getByRole("button", { name });
    // Until its first click a row's control is a plain button, and what it says on hover is the browser's.
    await expect(trigger).toHaveAttribute("title", name);
    await trigger.click();
    const popup = page.locator('[data-slot="popover-content"]');
    await expect(popup).toBeVisible();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);
    await expect(async () => {
      const anchor = await trigger.boundingBox();
      const content = await popup.boundingBox();
      expect(anchor).not.toBeNull();
      expect(content).not.toBeNull();
      if (!anchor || !content) return;
      // Collision handling may shift the popup, or flip it above a row near the bottom of the viewport (other specs
      // add issues to this project), but it must still meet its trigger.
      expect(content.x).toBeLessThan(anchor.x + anchor.width);
      expect(content.x + content.width).toBeGreaterThan(anchor.x);
      const below = Math.abs(content.y - (anchor.y + anchor.height));
      const above = Math.abs(content.y + content.height - anchor.y);
      expect(Math.min(below, above)).toBeLessThan(12);
    }).toPass();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

import { layout, openProject } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("the calendar's Today action follows the local date after a sleeping tab wakes", async ({ browser }) => {
  const page = await signIn(browser, "ada");
  await openProject(page, "Website");
  await page.clock.setFixedTime(new Date(2026, 9, 31, 12));
  await layout(page, "Calendar");
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
  await page.clock.setFixedTime(new Date(2026, 10, 1, 12));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("heading", { name: "November 2026" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Sunday, November 1", exact: true }).getByText("1", { exact: true }),
  ).toHaveAttribute("aria-current", "date");
  await expect(
    page.getByRole("group", { name: "Saturday, October 31", exact: true }).getByText("31", { exact: true }),
  ).not.toHaveAttribute("aria-current");
});

import { type Page, test } from "@playwright/test";
import { display, filter, groupBy, heading, layout, search } from "../helpers/page";
import {
  allIssues,
  contextOf,
  count,
  data,
  expect,
  live,
  note,
  sample,
  shot,
  TOTAL,
  timed,
  toasts,
  type Watched,
  watch,
  whole,
} from "./helpers";

const layouts = ["List", "Board", "Spreadsheet", "Calendar", "Timeline"] as const;
const selector = {
  List: '[data-testid="issue-row"]',
  Board: '[data-testid="issue-card"]',
  Spreadsheet: "tbody tr[data-issue-id]",
  Calendar: '[data-testid="calendar-issue"]',
  Timeline: '[data-testid="timeline-row"]',
};
const N = data.issueCount;
const paint = (page: Page) =>
  page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** A failure is a finding, not the end of the spec. */
async function step(w: Watched, title: string, run: () => Promise<unknown>) {
  await w.page.evaluate(() => ((window as unknown as { auditLongTasks?: number[] }).auditLongTasks ?? []).splice(0));
  try {
    const { ms, value } = await timed(async () => {
      const value = await run();
      await paint(w.page);
      return value;
    });
    note("measure", "views", title, { ms, ...(await sample(w)), ...(value && typeof value === "object" ? value : {}) });
    return true;
  } catch (error) {
    await shot(w.page, `fail-${title.replace(/\W+/g, "-")}`);
    note("finding", "views", `FAILED: ${title}`, String(error).slice(0, 500));
    await w.page.keyboard.press("Escape").catch(() => {});
    return false;
  }
}

test("layouts, search, filters, grouping, ordering, scrolling and keys over 100,000 issues", async ({ browser }) => {
  const context = await contextOf(browser, "ada");
  const w = await watch(context);
  const { page } = w;
  try {
    await step(w, "open all issues", async () => {
      await page.goto(allIssues);
      await expect(whole(page)).toBeVisible({ timeout: 180_000 });
      await live(page);
    });
    for (const name of layouts) {
      await step(w, `switch to ${name}`, async () => {
        await layout(page, name);
        await expect(page.locator(selector[name]).first()).toBeVisible({ timeout: 120_000 });
        return { mounted: await page.locator(selector[name]).count() };
      });
      await shot(page, `03-${name}`);
      await step(w, `${name}: search to one issue`, async () => {
        await search(page, "Audit issue 099999");
        await expect(count(page, 1)).toBeVisible({ timeout: 120_000 });
      });
      await step(w, `${name}: clear search`, async () => {
        await page.getByLabel("Search issues").press("Escape");
        await expect(whole(page)).toBeVisible({ timeout: 120_000 });
      });
      await step(w, `${name}: filter priority urgent`, async () => {
        await filter(page, "Priority", "Urgent");
        await expect(count(page, N / 5)).toBeVisible({ timeout: 120_000 });
      });
      await step(w, `${name}: clear filters`, async () => {
        await page.getByRole("button", { name: "Clear all", exact: true }).click();
        await expect(whole(page)).toBeVisible({ timeout: 120_000 });
      });
    }
    await layout(page, "List");
    for (const option of ["Priority", "Assignee", "Project", "Label", "Cycle", "No grouping", "State"]) {
      await step(w, `list: group by ${option}`, async () => {
        await groupBy(page, option);
        await expect(page.locator(selector.List).first()).toBeVisible({ timeout: 120_000 });
      });
    }
    await shot(page, "03-list-grouped-state");
    for (const option of ["Newest", "Last updated", "Due date", "Priority"]) {
      await step(w, `list: order by ${option}`, () =>
        display(page, async (panel) => {
          await panel.getByRole("button", { name: "Ordering" }).click();
          await page.getByRole("menuitemradio", { name: option, exact: true }).click();
        }),
      );
    }
    await groupBy(page, "No grouping");
    await step(w, "list: scroll to the end", async () => {
      const first = await page.locator(selector.List).first().getAttribute("data-issue-id");
      await page
        .locator(selector.List)
        .first()
        .evaluate((el) => {
          let parent = el.parentElement;
          while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
          if (!parent) throw new Error("no scroll container");
          parent.scrollTop = parent.scrollHeight;
          return parent.scrollHeight;
        });
      await expect.poll(() => page.locator(selector.List).first().getAttribute("data-issue-id")).not.toBe(first);
      return {
        scrollHeight: await page
          .locator(selector.List)
          .first()
          .evaluate((el) => {
            let parent = el.parentElement;
            while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
            return parent?.scrollHeight;
          }),
      };
    });
    await shot(page, "03-list-end");
    await heading(page).click();
    await step(w, "list: 30 presses of J", async () => {
      for (let i = 0; i < 30; i++) await page.keyboard.press("j");
      await expect(page.locator("[data-issue-id][data-focused]")).toBeInViewport();
    });
    await step(w, "list: Enter opens the preview", async () => {
      await page.keyboard.press("Enter");
      await expect(page.getByRole("complementary", { name: "Issue preview" })).toBeVisible();
    });
    await page.keyboard.press("Escape");
    await step(w, "list: select all with Ctrl+A", async () => {
      await page.keyboard.press("ControlOrMeta+a");
      await expect(page.getByRole("toolbar", { name: "Selected issues" })).toContainText(`${TOTAL} selected`);
    });
    await shot(page, "03-select-all");
    await page.keyboard.press("Escape");

    // More selected than one transaction carries (500 mutations).
    await filter(page, "Project", data.projects[9].name);
    await filter(page, "State", "Cancelled");
    await expect(count(page, N / 50)).toBeVisible({ timeout: 120_000 });
    await heading(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    const bar = page.getByRole("toolbar", { name: "Selected issues" });
    await expect(bar).toContainText(`${N / 50} selected`);
    const responses: number[] = [];
    page.on("response", (r) => {
      if (r.url().endsWith("/transactions")) responses.push(r.status());
    });
    await step(w, `bulk edit of ${N / 50} selected issues`, async () => {
      await bar.getByRole("button", { name: "Priority", exact: true }).click();
      await page.getByRole("menuitemradio", { name: "Low", exact: true }).click();
      await page.waitForResponse((r) => r.url().endsWith("/transactions"), { timeout: 60_000 });
      await page.waitForTimeout(3000);
      return { responses: [...responses], toasts: await toasts(page) };
    });
    await shot(page, "03-bulk-2000");
    note(responses.every((s) => s === 200) ? "ok" : "finding", "views", "bulk edit larger than one transaction", {
      responses,
      toasts: await toasts(page),
    });
  } finally {
    note(w.errors.length || w.failed.length ? "finding" : "ok", "views", "page errors in issue views", {
      errors: w.errors.slice(0, 10),
      console: w.consoleErrors.slice(0, 10),
      failed: w.failed,
    });
    await context.close();
  }
});

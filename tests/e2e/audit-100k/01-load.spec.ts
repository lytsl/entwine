import { test } from "@playwright/test";
import {
  allIssues,
  contextOf,
  count,
  data,
  expect,
  live,
  note,
  projectUrl,
  sample,
  shot,
  timed,
  watch,
  whole,
} from "./helpers";

test("cold open of one project (10,000 issues), then the whole workspace (100,000)", async ({ browser }) => {
  const context = await contextOf(browser, "ada");
  const w = await watch(context);
  const { page } = w;
  const loads: { ms: number; bytes: number; queries: number }[] = [];
  page.on("requestfinished", async (request) => {
    if (!request.url().endsWith("/load")) return;
    const sizes = await request.sizes().catch(() => null);
    loads.push({
      ms: Math.round(request.timing().responseEnd),
      bytes: sizes?.responseBodySize ?? -1,
      queries: request.postDataJSON()?.queries?.length ?? 0,
    });
  });
  try {
    const project = await timed(async () => {
      await page.goto(projectUrl(0));
      await expect(count(page, data.perProject)).toBeVisible({ timeout: 600_000 });
      await live(page);
    });
    note("measure", "load", "cold project page, 10,000 issues", {
      ms: project.ms,
      loads: [...loads],
      ...(await sample(w)),
    });
    await shot(page, "01-project-list");
    loads.length = 0;

    const all = await timed(async () => {
      await page.goto(allIssues);
      await expect(whole(page)).toBeVisible({ timeout: 180_000 });
      await live(page);
    });
    note("measure", "load", "cold all-issues page, 100,000 issues", {
      ms: all.ms,
      loads: [...loads],
      ...(await sample(w)),
    });
    await shot(page, "01-all-list");
    loads.length = 0;

    const warm = await timed(async () => {
      await page.reload();
      await expect(whole(page)).toBeVisible({ timeout: 180_000 });
      await live(page);
    });
    note("measure", "load", "warm reload of all issues from the device store", {
      ms: warm.ms,
      loadRequests: loads.length,
      ...(await sample(w)),
    });
    const storage = await page.evaluate(() => navigator.storage.estimate());
    note("measure", "load", "origin storage after holding the workspace", {
      usageMB: Math.round((storage.usage ?? 0) / 1048576),
      quotaMB: Math.round((storage.quota ?? 0) / 1048576),
    });
  } finally {
    note(w.errors.length || w.failed.length ? "finding" : "ok", "load", "page errors while loading", {
      errors: w.errors,
      console: w.consoleErrors.slice(0, 10),
      failed: w.failed,
    });
    await context.close();
  }
});

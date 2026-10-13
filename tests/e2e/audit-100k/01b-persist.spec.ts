import { test } from "@playwright/test";
import { choose, row, search } from "../helpers/page";
import { allIssues, contextOf, count, expect, live, note, sample, timed, titleOf, watch, whole } from "./helpers";

test("how long the device takes to hold 100,000 issues, and what a reload does before and after", async ({
  browser,
}) => {
  const context = await contextOf(browser, "ada");
  const w = await watch(context);
  const { page } = w;
  const loads: number[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/load")) loads.push(r.postDataJSON()?.queries?.length ?? 0);
  });
  const usage = async () =>
    Math.round(((await page.evaluate(() => navigator.storage.estimate())).usage ?? 0) / 1048576);
  try {
    await page.goto(allIssues);
    await expect(whole(page)).toBeVisible({ timeout: 180_000 });
    await live(page);
    const shown = performance.now();
    // An edit is sent only after earlier device writes: its response marks the stored load.
    await search(page, titleOf(99_999));
    await expect(count(page, 1)).toBeVisible({ timeout: 120_000 });
    const sent = page.waitForResponse((r) => r.url().endsWith("/transactions"), { timeout: 600_000 });
    const edit = await timed(async () => {
      await choose(page, row(page, titleOf(99_999)).getByLabel(/^Priority:/), "High");
      await expect(row(page, titleOf(99_999)).getByLabel("Priority: High")).toBeVisible();
    });
    const status = (await sent).status();
    const durableMs = Math.round(performance.now() - shown);
    note("measure", "persist", "first edit after a cold 100k load", {
      optimisticMs: edit.ms,
      serverAnsweredAfterMs: durableMs,
      status,
      usageMB: await usage(),
    });
    note(
      durableMs > 10_000 ? "finding" : "ok",
      "persist",
      "an edit made right after first load waits for the device store before it is sent",
      { durableMs },
    );
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForResponse((r) => r.url().endsWith("/transactions"), { timeout: 600_000 });
    await page.getByLabel("Search issues").press("Escape");
    await expect(whole(page)).toBeVisible({ timeout: 120_000 });
    loads.length = 0;
    w.consoleErrors.length = 0;
    const warm = await timed(async () => {
      await page.reload();
      await expect(whole(page)).toBeVisible({ timeout: 180_000 });
      await live(page);
    });
    note("measure", "persist", "warm reload once the store holds the workspace", {
      ms: warm.ms,
      loadRequests: [...loads],
      usageMB: await usage(),
      console: [...w.consoleErrors],
      ...(await sample(w)),
    });
    note(loads.length ? "finding" : "ok", "persist", "a reload of a stored workspace asks the server for rows", {
      loads: [...loads],
    });

    const second = await watch(context);
    const secondLoads: number[] = [];
    second.page.on("request", (r) => {
      if (r.url().endsWith("/load")) secondLoads.push(1);
    });
    const tab = await timed(async () => {
      await second.page.goto(allIssues);
      await expect(whole(second.page)).toBeVisible({ timeout: 180_000 });
      await live(second.page);
    });
    note("measure", "persist", "second tab of the same member", {
      ms: tab.ms,
      loadRequests: secondLoads.length,
      console: second.consoleErrors,
      errors: second.errors,
      ...(await sample(second)),
    });
  } finally {
    note(w.errors.length ? "finding" : "ok", "persist", "page errors", { errors: w.errors, console: w.consoleErrors });
    await context.close();
  }
});

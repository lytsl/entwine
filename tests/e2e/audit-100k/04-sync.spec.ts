import { test } from "@playwright/test";
import { choose, peek, row, search } from "../helpers/page";
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
  serverIssue,
  shot,
  step,
  TOTAL,
  timed,
  titleOf,
  transact,
  watch,
  whole,
} from "./helpers";

const P = 1;
/** Issues of project 1, by their number in it. */
const id = (n: number) => data.ids[P * data.perProject + n - 1];
const title = (n: number) => titleOf(P * data.perProject + n);

test("two members: live edits and concurrent edits", async ({ browser }) => {
  const a = await watch(await contextOf(browser, "ada"));
  const b = await watch(await contextOf(browser, "bob"));
  const [ada, bob] = [a.page, b.page];
  try {
    for (const page of [ada, bob]) {
      await page.goto(projectUrl(P));
      await expect(count(page, data.perProject)).toBeVisible({ timeout: 300_000 });
      await live(page);
      await search(page, "Audit issue 01000");
      await expect(page.getByTestId("issue-row").first()).toBeVisible();
      await page.getByLabel("Search issues").press("Tab");
    }
    const latencies: number[] = [];
    for (const priority of ["High", "Low", "Urgent", "Medium", "High"]) {
      const start = performance.now();
      await choose(ada, row(ada, title(1)).getByLabel(/^Priority:/), priority);
      await expect(row(bob, title(1)).getByLabel(`Priority: ${priority}`)).toBeVisible();
      latencies.push(Math.round(performance.now() - start));
    }
    note("measure", "sync", "edit by one member seen by another (click to remote paint)", { latencies });

    await step(a, "sync", "both members rename the same issue at once and converge", async () => {
      const [pa, pb] = [await peek(ada, title(2)), await peek(bob, title(2))];
      await pa.getByLabel("Title").fill("Renamed by Ada");
      await pb.getByLabel("Title").fill("Renamed by Bob");
      await Promise.all([pa.getByLabel("Title").press("Enter"), pb.getByLabel("Title").press("Enter")]);
      await expect.poll(async () => (await serverIssue(id(2))).title, { timeout: 15_000 }).toMatch(/^Renamed by/);
      await ada.waitForTimeout(1500);
      const final = (await serverIssue(id(2))).title;
      await expect(pa.getByLabel("Title")).toHaveValue(final);
      await expect(pb.getByLabel("Title")).toHaveValue(final);
      return { final };
    });
    await ada.keyboard.press("Escape");
    await bob.keyboard.press("Escape");
    await transact("ada", [{ model: "Issue", type: "update", key: id(2), value: { title: title(2) } }]);
  } finally {
    note(a.errors.length || b.errors.length ? "finding" : "ok", "sync", "page errors (two members)", {
      ada: a.errors,
      bob: b.errors,
      adaConsole: a.consoleErrors.slice(0, 8),
      bobConsole: b.consoleErrors.slice(0, 8),
    });
    await Promise.all([ada.context().close(), bob.context().close()]);
  }
});

test("a burst of 5,000 remote changes reaches a tab holding 100,000 issues", async ({ browser }) => {
  const a = await watch(await contextOf(browser, "ada"));
  const page = a.page;
  try {
    await page.goto(allIssues);
    await expect(whole(page)).toBeVisible({ timeout: 180_000 });
    await live(page);
    await sample(a);
    const targets = Array.from({ length: 5000 }, (_, n) => data.ids[2 * data.perProject + n]);
    const burst = await timed(async () => {
      for (let i = 0; i < targets.length; i += 500)
        await transact(
          "bob",
          targets.slice(i, i + 500).map((key) => ({ model: "Issue", type: "update", key, value: { estimate: 8 } })),
        );
    });
    const last = titleOf(2 * data.perProject + 5000);
    const seen = await timed(async () => {
      await search(page, last);
      await expect(row(page, last).getByText("8", { exact: true }).first()).toBeVisible({ timeout: 300_000 });
    });
    note("measure", "sync", "5,000 remote updates applied to a 100k tab", {
      serverMs: burst.ms,
      visibleAfterMs: seen.ms,
      ...(await sample(a)),
    });
    const single = await timed(async () => {
      await transact("bob", [{ model: "Issue", type: "update", key: targets[4999], value: { priority: "urgent" } }]);
      await expect(row(page, last).getByLabel("Priority: Urgent")).toBeVisible({ timeout: 60_000 });
    });
    note("measure", "sync", "one remote change seen in a 100k tab", { ms: single.ms });
  } finally {
    note(a.errors.length ? "finding" : "ok", "sync", "page errors (burst)", {
      errors: a.errors,
      console: a.consoleErrors.slice(0, 8),
    });
    await page.context().close();
  }
});

test("an edit made right after a first 100k load, then the tab closes", async ({ browser }) => {
  const context = await contextOf(browser, "cy");
  const c = await watch(context);
  const page = c.page;
  const target = titleOf(3 * data.perProject + 77);
  const key = data.ids[3 * data.perProject + 76];
  try {
    await page.goto(allIssues);
    await expect(whole(page)).toBeVisible({ timeout: 180_000 });
    await live(page);
    let answered = false;
    page.on("response", (r) => {
      if (r.url().endsWith("/transactions")) answered = true;
    });
    await search(page, target);
    await expect(count(page, 1)).toBeVisible({ timeout: 120_000 });
    await choose(page, row(page, target).getByLabel(/^Priority:/), "Low");
    await expect(row(page, target).getByLabel("Priority: Low")).toBeVisible();
    const label = await page.getByTestId("sync-status").textContent();
    await page.waitForTimeout(4000);
    const labelLater = await page.getByTestId("sync-status").textContent();
    await shot(page, "04-edit-during-store");
    const serverBeforeClose = (await serverIssue(key)).priority;
    const waiting = await page.getByTestId("sync-status").locator("..").getAttribute("title");
    await page.close();
    note("measure", "sync", "edit right after first load: state when the tab closed 4 s later", {
      answeredBeforeClose: answered,
      serverBeforeClose,
      waiting,
      statusShown: label,
      statusLater: labelLater,
      serverPriorityAtClose: (await serverIssue(key)).priority,
    });
    const again = await watch(context);
    await again.page.goto(allIssues);
    await expect(whole(again.page)).toBeVisible({ timeout: 180_000 });
    await live(again.page);
    await again.page.waitForTimeout(15_000);
    const after = (await serverIssue(key)).priority;
    note(
      after === "low" ? "ok" : "finding",
      "sync",
      "an edit shown as applied is lost when the tab closes while the first load is still being stored",
      { answeredBeforeClose: answered, serverPriorityAfterReturn: after, console: again.consoleErrors.slice(0, 5) },
    );
    if (after === "low")
      await transact("ada", [{ model: "Issue", type: "update", key, value: { priority: "urgent" } }]);
  } finally {
    await context.close();
  }
});

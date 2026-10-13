import { test } from "@playwright/test";
import { filter, heading, search } from "../helpers/page";
import {
  allIssues,
  api,
  contextOf,
  count,
  data,
  expect,
  live,
  note,
  projectUrl,
  sample,
  shot,
  step,
  timed,
  toasts,
  transact,
  watch,
  whole,
} from "./helpers";

const slug = data.workspace.slug;

test("palette, light pages and reloads once the device holds 100,000 issues", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "cy"));
  const { page } = w;
  const s = (title: string, run: () => Promise<unknown>) => step(w, "scale", title, run);
  try {
    // A member who has only opened one project asks the palette for an issue of another.
    await page.goto(projectUrl(0));
    await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 180_000 });
    await live(page);
    await sample(w);
    await s("palette: first search from a project page", async () => {
      await page.keyboard.press("ControlOrMeta+k");
      await page.getByRole("dialog").getByRole("combobox").fill("Audit issue 077777");
      await expect(page.getByRole("dialog").getByRole("option", { name: /Audit issue 077777/ })).toBeVisible({
        timeout: 180_000,
      });
      return sample(w);
    });
    await shot(page, "08-palette");
    await s("palette: second search", async () => {
      await page.getByRole("dialog").getByRole("combobox").fill("AUD3-4242");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("option", { name: /AUD3-4242/ })
          .first(),
      ).toBeVisible({ timeout: 60_000 });
      return sample(w);
    });
    await s("palette: a search with thousands of matches", async () => {
      await page.getByRole("dialog").getByRole("combobox").fill("Audit issue 0");
      await expect(page.getByRole("dialog").getByRole("option").first()).toBeVisible({ timeout: 60_000 });
      return { options: await page.getByRole("dialog").getByRole("option").count(), ...(await sample(w)) };
    });
    await shot(page, "08-palette-many");
    await s("palette: open an issue with Enter", async () => {
      await page.getByRole("dialog").getByRole("combobox").fill("AUD3-4242");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("option", { name: /AUD3-4242/ })
          .first(),
      ).toBeVisible({ timeout: 60_000 });
      await page.keyboard.press("Enter");
      await expect(heading(page)).toHaveText("AUD3-4242", { timeout: 30_000 });
    });
    await s("shortcut help opens with ?", async () => {
      await heading(page).click();
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog")).toBeVisible();
    });
    await shot(page, "08-shortcuts");
    await page.keyboard.press("Escape");
    // Let the device finish storing, then see what a reload of a page that needs no issues costs.
    await page.goto(allIssues);
    await expect(whole(page)).toBeVisible({ timeout: 180_000 });
    await page.waitForTimeout(100_000);
    for (const [name, path] of [
      ["labels", "settings/labels"],
      ["members", "settings/members"],
      ["one issue", `issues/${data.ids[5]}`],
      ["a project", `projects/${data.projects[0].id}`],
    ] as const) {
      await s(`hard load of ${name} with 100k stored`, async () => {
        await page.goto(`/${slug}/${path}`);
        await expect(heading(page)).toBeVisible({ timeout: 180_000 });
        await live(page);
        return sample(w);
      });
    }
  } finally {
    note(w.errors.length ? "finding" : "ok", "scale", "page errors (palette, reloads)", {
      errors: w.errors,
      console: w.consoleErrors.slice(0, 8),
    });
    await page.context().close();
  }
});

test("bulk edits at the limit, and server-side cascades seen by a tab holding everything", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "bob"));
  const { page } = w;
  const s = (title: string, run: () => Promise<unknown>) => step(w, "scale", title, run);
  try {
    await page.goto(allIssues);
    await expect(whole(page)).toBeVisible({ timeout: 180_000 });
    await live(page);
    // 400 issues: project 9, cancelled, no due date is 286; use project 9 + cancelled + urgent = 400.
    await filter(page, "Project", data.projects[9].name);
    await filter(page, "State", "Cancelled");
    await filter(page, "Priority", "Urgent");
    await page.waitForTimeout(1000);
    const shown = Number((await page.getByTitle(/^\d+ issues$/).getAttribute("title"))?.split(" ")[0]);
    await heading(page).click();
    await page.keyboard.press("ControlOrMeta+a");
    const bar = page.getByRole("toolbar", { name: "Selected issues" });
    await expect(bar).toContainText(`${shown} selected`);
    const statuses: number[] = [];
    page.on("response", (r) => {
      if (r.url().endsWith("/transactions")) statuses.push(r.status());
    });
    await sample(w);
    await s(`bulk: set the estimate of ${shown} selected issues`, async () => {
      await bar.getByRole("button", { name: "Estimate", exact: true }).click();
      await page.getByRole("menuitemradio").first().click();
      await expect.poll(() => statuses.length, { timeout: 120_000 }).toBeGreaterThan(0);
      await page.waitForTimeout(1500);
      return { shown, statuses: [...statuses], toasts: await toasts(page), ...(await sample(w)) };
    });
    await shot(page, "08-bulk-400");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await s("bulk: undo it", async () => {
      const before = statuses.length;
      await heading(page).click();
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => statuses.length, { timeout: 120_000 }).toBeGreaterThan(before);
      return { statuses: [...statuses], toasts: await toasts(page), ...(await sample(w)) };
    });
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await expect(whole(page)).toBeVisible({ timeout: 60_000 });

    // Cascades: each is one transaction on the server and one event on the stream.
    await sample(w);
    const label = data.labels[3];
    await s("server deletes a label applied to 25,000 issues", async () => {
      const r = await timed(() => transact("ada", [{ model: "Label", type: "delete", key: label.id, value: {} }]));
      const seen = await timed(async () => {
        await page.getByRole("button", { name: "Filters" }).click();
        await expect(
          page.getByRole("dialog", { name: "Filters" }).getByRole("checkbox", { name: label.name, exact: true }),
        ).toHaveCount(0, { timeout: 300_000 });
        await page.keyboard.press("Escape");
      });
      return {
        serverMs: r.ms,
        status: r.value.status,
        body: r.value.text.slice(0, 120),
        tabCaughtUpMs: seen.ms,
        status2: await page.getByTestId("sync-status").textContent(),
        ...(await sample(w)),
      };
    });
    await s("server deletes a cycle holding 6,667 issues", async () => {
      const r = await timed(() =>
        transact("ada", [{ model: "Cycle", type: "delete", key: data.cycles[7].id, value: {} }]),
      );
      const health = await timed(() => fetch(`${data.origin}/api/health`));
      await page.waitForTimeout(8000);
      return {
        serverMs: r.ms,
        status: r.value.status,
        body: r.value.text.slice(0, 120),
        healthAfterMs: health.ms,
        tabStatus: await page.getByTestId("sync-status").textContent(),
        ...(await sample(w)),
      };
    });
    await s("server deletes a project of 10,000 issues", async () => {
      const started = performance.now();
      const pending = transact("ada", [{ model: "Project", type: "delete", key: data.projects[8].id, value: {} }]);
      // Does the server answer anyone else meanwhile?
      await new Promise((r) => setTimeout(r, 500));
      const other = await timed(() => api("cy", `${data.endpoint}/load`, { queries: [{ model: "Label" }] }));
      const health = await timed(() => fetch(`${data.origin}/api/health`));
      const r = await pending;
      const serverMs = Math.round(performance.now() - started);
      const seen = await timed(async () => {
        await expect(page.getByTitle(/^9\d{4} issues$/)).toBeVisible({ timeout: 600_000 });
      });
      return {
        serverMs,
        status: r.status,
        body: r.text.slice(0, 160),
        otherMemberLoadDuringMs: other.ms,
        healthDuringMs: health.ms,
        tabCaughtUpMs: seen.ms,
        tabStatus: await page.getByTestId("sync-status").textContent(),
        count: await page.getByTitle(/^\d+ issues$/).getAttribute("title"),
        ...(await sample(w)),
      };
    });
    await shot(page, "08-after-project-delete");
    await s("the tab still follows live changes afterwards", async () => {
      const key = data.ids[5];
      await search(page, "Audit issue 000006");
      await expect(count(page, 1)).toBeVisible({ timeout: 60_000 });
      await transact("ada", [{ model: "Issue", type: "update", key, value: { title: "Audit issue 000006 touched" } }]);
      await expect(page.getByText("Audit issue 000006 touched")).toBeVisible({ timeout: 60_000 });
      await transact("ada", [{ model: "Issue", type: "update", key, value: { title: "Audit issue 000006" } }]);
    });
  } finally {
    note(w.errors.length ? "finding" : "ok", "scale", "page errors (bulk, cascades)", {
      errors: w.errors,
      console: w.consoleErrors.slice(0, 8),
      failed: w.failed,
    });
    await page.context().close();
  }
});

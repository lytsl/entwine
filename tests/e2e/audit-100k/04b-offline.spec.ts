import { type Page, test } from "@playwright/test";
import { heading, row, search } from "../helpers/page";
import {
  api,
  contextOf,
  count,
  data,
  expect,
  live,
  note,
  projectUrl,
  serverIssue,
  shot,
  step,
  titleOf,
  toasts,
  transact,
  watch,
} from "./helpers";

const P = 5;
const id = (n: number) => data.ids[P * data.perProject + n - 1];
const title = (n: number) => titleOf(P * data.perProject + n);
const status = (page: Page) => page.getByTestId("sync-status");
/** Waits for the picker to be gone, so the next one opens alone. */
async function setPriority(page: Page, n: number, priority: string) {
  await row(page, title(n))
    .getByLabel(/^Priority:/)
    .click();
  await page.getByRole("option", { name: priority, exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(row(page, title(n)).getByLabel(`Priority: ${priority}`)).toBeVisible();
}
const priorities = async () =>
  Object.fromEntries(
    await Promise.all([1, 3, 5, 7].map(async (n) => [n, (await serverIssue(id(n)))?.priority ?? "deleted"])),
  );

test("offline edits, reload while offline, what undo undoes afterwards, and a refused offline edit", async ({
  browser,
}) => {
  const a = await watch(await contextOf(browser, "ada"));
  const page = a.page;
  const sent: { status: number; revert: boolean }[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith("/transactions"))
      sent.push({ status: r.status(), revert: !!r.request().postDataJSON()?.revert });
  });
  try {
    await page.goto(projectUrl(P));
    await expect(count(page, data.perProject)).toBeVisible({ timeout: 180_000 });
    await live(page);
    await search(page, "Audit issue 05000");
    await expect(count(page, 9)).toBeVisible();
    await page.getByLabel("Search issues").press("Tab");
    const original = await priorities();

    await setPriority(page, 1, "High");
    await expect.poll(() => sent.length).toBe(1);
    await page.context().setOffline(true);
    await expect(status(page)).toHaveText(/^Offline/, { timeout: 70_000 });
    await setPriority(page, 3, "Low");
    await page.keyboard.press("c");
    await page.getByRole("dialog").getByLabel("Title").fill("Audit issue 05000 made offline");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Create issue/ })
      .click();
    await expect(page.getByRole("dialog", { name: "New issue" })).toHaveCount(0);
    await page.waitForTimeout(1000);
    note("measure", "offline", "status after two offline changes", {
      status: await status(page).textContent(),
      hint: await status(page).locator("..").getAttribute("title"),
      newRow: (
        await row(page, "made offline")
          .innerText()
          .catch(() => "NOT SHOWN")
      ).replace(/\n/g, " | "),
    });
    await shot(page, "04b-offline-waiting");

    await page.context().setOffline(false);
    await page.context().route("**/api/w/**", (route) => route.abort("internetdisconnected"));
    await page.reload();
    await expect(row(page, title(3)).getByLabel("Priority: Low")).toBeVisible({ timeout: 120_000 });
    await page.waitForTimeout(8000);
    const afterReload = await status(page).textContent();
    note(
      afterReload === "Offline · 2 changes waiting" ? "ok" : "finding",
      "offline",
      "after a reload while offline the waiting changes are still counted",
      {
        status: afterReload,
        offlineIssueShown: await row(page, "made offline").count(),
      },
    );
    await shot(page, "04b-offline-reloaded");

    await page.context().unroute("**/api/w/**");
    await expect(status(page)).toHaveText("Live", { timeout: 120_000 });
    await expect.poll(async () => (await priorities())[3], { timeout: 30_000 }).toBe("low");
    const made = (
      await api("ada", `${data.endpoint}/load`, {
        queries: [{ model: "Issue", where: { projectId: data.projects[P].id } }],
      })
    ).json.rows.Issue.filter((i: { title: string }) => i.title.endsWith("made offline"));
    note(made.length === 1 ? "ok" : "finding", "offline", "an issue created offline is saved once after reconnecting", {
      saved: made.length,
      number: made[0]?.number,
      shown: (
        await row(page, "made offline")
          .innerText()
          .catch(() => "NOT SHOWN")
      ).replace(/\n/g, " | "),
    });

    // What does undo undo now? The newest edit is C.
    await setPriority(page, 5, "Low");
    await expect.poll(async () => (await priorities())[5]).toBe("low");
    await heading(page).click();
    const before = await priorities();
    const madeBefore = made.length;
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(4000);
    const afterOne = await priorities();
    const stillThere = (
      await api("ada", `${data.endpoint}/load`, { queries: [{ model: "Issue", where: { id: made[0]?.id ?? "none" } }] })
    ).json.rows.Issue.length;
    await page.keyboard.press("ControlOrMeta+z");
    await page.waitForTimeout(4000);
    const afterTwo = await priorities();
    const undoneFirst = afterOne[5] !== "low";
    note(undoneFirst ? "ok" : "finding", "offline", "after an offline reload, undo reverts the newest edit first", {
      original,
      before,
      afterFirstUndo: afterOne,
      offlineIssueStillExistsAfterFirstUndo: `${stillThere}/${madeBefore}`,
      afterSecondUndo: afterTwo,
      transactions: sent,
      toasts: await toasts(page),
    });
    await shot(page, "04b-after-undo");

    await page.context().setOffline(true);
    await expect(status(page)).toHaveText(/^Offline/, { timeout: 70_000 });
    await setPriority(page, 7, "Low");
    await transact("bob", [{ model: "Issue", type: "delete", key: id(7), value: {} }]);
    await page.context().setOffline(false);
    await step(a, "offline", "an offline edit to an issue deleted meanwhile rolls back and says why", async () => {
      await expect(status(page)).toHaveText("Live", { timeout: 120_000 });
      await expect(row(page, title(7))).toHaveCount(0, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      return { toasts: await toasts(page), transactions: sent.slice(-2) };
    });
    await shot(page, "04b-refused");
  } finally {
    note(a.errors.length ? "finding" : "ok", "offline", "page errors", {
      errors: a.errors,
      console: a.consoleErrors.filter((c) => !c.includes("ERR_INTERNET")).slice(0, 8),
    });
    await page.context().close();
  }
});

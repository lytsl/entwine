import { existsSync, writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { row, search } from "../helpers/page";
import {
  contextOf,
  count,
  data,
  expect,
  live,
  note,
  projectUrl,
  serverIssue,
  shot,
  signIn,
  step,
  timed,
  titleOf,
  toasts,
  transact,
  watch,
} from "./helpers";

const marker = process.env.AUDIT_MARKER ?? "";

test("the backend goes away and comes back while a member is working", async ({ browser }) => {
  test.skip(!marker, "run by the restart script, which stops and starts the backend");
  const w = await watch(await contextOf(browser, "ada"));
  const { page } = w;
  const n = 3 * data.perProject + 500;
  const key = data.ids[n - 1];
  try {
    await page.goto(projectUrl(3));
    await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 180_000 });
    await live(page);
    await search(page, titleOf(n));
    await expect(count(page, 1)).toBeVisible();
    const before = (await serverIssue(key)).priority;
    const to = before === "low" ? "Medium" : "Low";
    writeFileSync(`${marker}.ready`, "");
    const down = await timed(() =>
      expect(page.getByTestId("sync-status")).toHaveText(/^Offline/, { timeout: 120_000 }),
    );
    note("measure", "resilience", "time until a stopped backend shows as Offline", { ms: down.ms });
    await row(page, titleOf(n))
      .getByLabel(/^Priority:/)
      .click();
    await page.getByRole("option", { name: to, exact: true }).click();
    await expect(row(page, titleOf(n)).getByLabel(`Priority: ${to}`)).toBeVisible();
    await page.waitForTimeout(3000);
    await shot(page, "09-backend-down");
    note("measure", "resilience", "an edit while the backend is down", {
      status: await page.getByTestId("sync-status").textContent(),
      toasts: await toasts(page),
    });
    writeFileSync(`${marker}.edited`, "");
    const up = await timed(() => expect(page.getByTestId("sync-status")).toHaveText("Live", { timeout: 300_000 }));
    await expect.poll(async () => (await serverIssue(key)).priority, { timeout: 60_000 }).toBe(to.toLowerCase());
    note("ok", "resilience", "after the backend returns the tab is live again and the edit is saved", {
      reconnectMs: up.ms,
      toasts: await toasts(page),
      errors: w.errors,
    });
    await transact("ada", [{ model: "Issue", type: "update", key, value: { priority: before } }]);
  } catch (error) {
    await shot(page, "fail-resilience");
    note("finding", "resilience", "FAILED: backend restart", String(error).slice(0, 600));
  } finally {
    if (!existsSync(`${marker}.edited`)) writeFileSync(`${marker}.edited`, "");
    await page.context().close();
  }
});

test("a session revoked elsewhere, and a workspace named after an app page", async ({ browser }) => {
  test.skip(!!marker, "not part of the restart run");
  const w = await watch(await contextOf(browser, null));
  const { page } = w;
  try {
    await page.goto("/login");
    await signIn(page, "eve@example.com");
    await live(page);
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const out = await fetch(`${data.origin}/api/auth/sign-out`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: data.origin, Cookie: cookie },
      body: "{}",
    });
    await step(w, "auth", "a tab whose session was ended elsewhere asks to sign in", async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 90_000 });
      return { signOutStatus: out.status };
    });
    await page.waitForTimeout(11_000);
    await signIn(page, "eve@example.com");
    await live(page);
    for (const name of ["Signup", "Login"]) {
      await page.goto("/new");
      await page.getByLabel("Name").fill(name);
      const url = await page.getByLabel("URL").inputValue();
      await page.getByRole("button", { name: "Create workspace" }).click();
      await page.waitForTimeout(4000);
      await shot(page, `09-workspace-${name}`);
      const text = (await page.locator("body").innerText()).slice(0, 140).replace(/\n/g, " | ");
      const opened = await page.getByTestId("sync-status").count();
      note(opened ? "ok" : "finding", "flow", `the form creates a workspace at /${url}, which is an app page`, {
        landed: page.url(),
        opened,
        text,
      });
    }
    await page.goto("/");
    await page.waitForTimeout(4000);
    note("measure", "flow", "home after creating those workspaces", {
      url: page.url(),
      text: (await page.locator("body").innerText()).slice(0, 100).replace(/\n/g, " | "),
    });
  } finally {
    await page.context().close();
  }
});

/** What the audit found broken, checked again after the fixes. Runs last: it removes a member it invited itself. */
import { test } from "@playwright/test";
import { heading, row, search } from "../helpers/page";
import {
  allIssues,
  api,
  contextOf,
  cookieOf,
  cookiesFrom,
  count,
  data,
  expect,
  live,
  note,
  post,
  sample,
  serverIssue,
  shot,
  step,
  timed,
  titleOf,
  transact,
  watch,
  whole,
} from "./helpers";

const slug = data.workspace.slug;
const stored = (page: import("@playwright/test").Page) =>
  page.evaluate(async () => {
    const root = (await navigator.storage.getDirectory()) as FileSystemDirectoryHandle & {
      keys(): AsyncIterable<string>;
    };
    const names: string[] = [];
    for await (const name of root.keys()) names.push(name);
    return names.filter((name) => name.endsWith(".sqlite"));
  });

test("a first edit, a reload while storing, bulk limits and light pages at 100,000 issues", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "cy"));
  const { page } = w;
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/memory only/.test(message.text())) warnings.push(message.text().slice(0, 200));
  });
  const s = (title: string, run: () => Promise<unknown>) => step(w, "fixes", title, run);
  const n = data.perProject + 777;
  const key = data.ids[n - 1];
  try {
    await s("My issues, cold: only the member's issues are requested", async () => {
      const loads: number[] = [];
      // A body may be gone by the time it is asked for; the next step's are not this step's to measure.
      const measure = (r: import("@playwright/test").Response) => {
        if (r.url().endsWith("/load"))
          void r.body().then(
            (b) => loads.push(Math.round(b.length / 1024)),
            () => {},
          );
      };
      page.on("response", measure);
      await page.goto(`/${slug}`);
      await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 180_000 });
      await live(page);
      page.off("response", measure);
      return { loadsKB: loads, title: await page.title(), ...(await sample(w)) };
    });
    await s("All issues, cold", async () => {
      await page.goto(allIssues);
      await expect(whole(page)).toBeVisible({ timeout: 180_000 });
      return { title: await page.title(), header: await page.getByTitle(/^\d+ issues$/).textContent() };
    });
    const before = (await serverIssue(key)).priority;
    const to = before === "low" ? "Medium" : "Low";
    await s("the first edit after a cold load reaches the server", async () => {
      await search(page, titleOf(n));
      await expect(count(page, 1)).toBeVisible({ timeout: 60_000 });
      await row(page, titleOf(n))
        .getByLabel(/^Priority:/)
        .click();
      await page.getByRole("option", { name: to, exact: true }).click();
      const sent = await timed(() =>
        expect.poll(async () => (await serverIssue(key)).priority, { timeout: 150_000 }).toBe(to.toLowerCase()),
      );
      return { editToServerMs: sent.ms };
    });
    await s("a reload while the device is still storing keeps the device store", async () => {
      // A full load of the page without the search the edit used, while the first load is still being stored.
      await page.goto(allIssues);
      await expect(whole(page)).toBeVisible({ timeout: 180_000 });
      await live(page);
      return { memoryWarnings: warnings, errors: w.consoleErrors.slice(0, 4), stores: await stored(page) };
    });
    await s("more than 500 selected: the bar says so and sends nothing", async () => {
      const sent: number[] = [];
      page.on("response", (r) => {
        if (r.url().endsWith("/transactions")) sent.push(r.status());
      });
      await heading(page).click();
      await page.keyboard.press("ControlOrMeta+a");
      const bar = page.getByRole("toolbar", { name: "Selected issues" });
      await expect(bar).toContainText("Select 500 issues or fewer");
      const text = await bar.innerText();
      await shot(page, "fix-bulk-limit");
      await page.keyboard.press("Escape");
      return { bar: text.replace(/\n/g, " | "), sent };
    });
    await sample(w);
    await s("the projects list with every issue held", async () => {
      await page.goto(`/${slug}/projects`);
      await expect(page.getByText(/of \d+ done/).first()).toBeVisible({ timeout: 180_000 });
      return sample(w);
    });
    await s("an issue with 2,000 comments shows its latest entries", async () => {
      await page.goto(`/${slug}/issues/${data.edge.hub}`);
      const more = page.getByRole("button", { name: /Show earlier activity/ });
      await expect(more).toBeVisible({ timeout: 120_000 });
      const shown = await page.getByRole("region", { name: "Activity" }).locator("ol > li").count();
      await shot(page, "fix-timeline");
      return {
        button: await more.textContent(),
        shown,
        hint: await page.getByText(/to send$/).textContent(),
        ...(await sample(w)),
      };
    });
    await transact("ada", [{ model: "Issue", type: "update", key, value: { priority: before } }]);
  } finally {
    note(w.errors.length ? "finding" : "ok", "fixes", "page errors", { errors: w.errors });
    await page.context().close();
  }
});

test("a removed member's device keeps nothing, and the server stays reachable under a heavy load", async ({
  browser,
}) => {
  const email = `gone${Date.now()}@example.com`;
  const signUp = await post("/api/auth/sign-up/email", { name: "Gone", email, password: "password123" });
  const cookie = cookieOf(signUp);
  const invitation = await api("ada", "/api/auth/organization/invite-member", {
    email,
    role: "member",
    organizationId: data.workspace.id,
  });
  await post("/api/auth/organization/accept-invitation", { invitationId: invitation.json.id }, cookie);
  const context = await browser.newContext();
  await context.addCookies(cookiesFrom(cookie));
  const w = await watch(context);
  const { page } = w;
  try {
    await step(w, "fixes", "removed while the workspace is open: the stored copy is deleted", async () => {
      await page.goto(`/${slug}/projects/${data.projects[0].id}`);
      await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 180_000 });
      await live(page);
      await page.waitForTimeout(15_000);
      const before = await stored(page);
      await api("ada", "/api/auth/organization/remove-member", {
        memberIdOrEmail: email,
        organizationId: data.workspace.id,
      });
      await expect(page.getByText(/You no longer belong to/)).toBeVisible({ timeout: 60_000 });
      const gone = await timed(() => expect.poll(() => stored(page), { timeout: 120_000 }).toEqual([]));
      return { before, deletedAfterMs: gone.ms };
    });
    await step(w, "fixes", "a workspace cannot take an app page's address", async () => {
      await page.goto("/new");
      await page.getByLabel("Name").fill("Signup");
      await page.getByRole("button", { name: "Create workspace" }).click();
      await expect(page.getByText("That URL is reserved; choose another")).toBeVisible();
      return { url: page.url() };
    });
  } finally {
    await page.context().close();
  }

  const queries = Array.from({ length: 30 }, () => ({ model: "Issue" }));
  const started = performance.now();
  const heavy = api("cy", `${data.endpoint}/load`, { queries });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const health = await timed(() => fetch(`${data.origin}/api/health`));
  const response = await heavy;
  note("measure", "fixes", "thirty copies of the all-issues query in one load", {
    loadMs: Math.round(performance.now() - started),
    healthDuringMs: health.ms,
    rows: response.json?.rows?.Issue?.length,
  });
  const varied = Array.from({ length: 30 }, (_, i) => ({
    model: "Issue",
    where: { priority: ["urgent", "high", "medium", "low", "none", `x${i}`] },
  }));
  const slow = api("cy", `${data.endpoint}/load`, { queries: varied });
  const delays: number[] = [];
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    delays.push((await timed(() => fetch(`${data.origin}/api/health`))).ms);
  }
  await slow;
  note("measure", "fixes", "thirty different whole-table queries in one load: health check delays meanwhile", {
    delays,
  });
  const foreign = await fetch(`${data.origin}${data.endpoint}/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://evil.example", Cookie: data.users.ada.cookie },
    body: JSON.stringify({ queries: [{ model: "Label" }] }),
  });
  note(foreign.status === 403 ? "ok" : "finding", "fixes", "a load naming another origin", { status: foreign.status });
});

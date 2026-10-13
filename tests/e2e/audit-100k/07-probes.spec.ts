import { test } from "@playwright/test";
import { row, search } from "../helpers/page";
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
  opfs,
  post,
  serverIssue,
  shot,
  signIn,
  signOut,
  timed,
  titleOf,
  transact,
  watch,
  whole,
} from "./helpers";

const slug = data.workspace.slug;

test("stored HTML in a description: what reaches the DOM and the network", async ({ browser }) => {
  const id = crypto.randomUUID();
  const p = data.edge.project.id;
  const body =
    'before <img src="http://localhost:4100/api/health?pixel=1" onerror="window.__xss=7"> <a href="javascript:window.__xss=8">click</a> <iframe src="http://localhost:4100/login"></iframe> <style>body{display:none}</style> [md](javascript:window.__xss=9) ![pic](http://localhost:4100/api/health?mdpixel=1) after';
  await transact("ada", [
    {
      model: "Issue",
      type: "insert",
      key: id,
      value: { id, projectId: p, title: "Hostile description", stateId: `${p}:backlog`, description: body },
    },
  ]);
  await transact("ada", [
    { model: "Comment", type: "insert", key: `${id}c`, value: { id: `${id}c`, issueId: id, body } },
  ]);
  const w = await watch(await contextOf(browser, "bob"));
  const fetched: string[] = [];
  w.page.on("request", (r) => {
    if (r.url().includes("pixel")) fetched.push(r.url());
  });
  try {
    await w.page.goto(`/${slug}/issues/${id}`);
    await expect(w.page.getByLabel("Title")).toBeVisible({ timeout: 60_000 });
    await w.page.waitForTimeout(2500);
    const dom = await w.page.evaluate(() => {
      const d = document.querySelector('[aria-label="Description"]');
      const c = document.querySelector('[data-testid="comment"]');
      return {
        description: d?.innerHTML.slice(0, 700),
        comment: c?.innerHTML.slice(0, 900),
        iframes: document.querySelectorAll("iframe").length,
        styles: document.querySelectorAll("body style").length,
        jsLinks: [...document.querySelectorAll("a")].filter((a) =>
          (a.getAttribute("href") ?? "").startsWith("javascript:"),
        ).length,
        imgs: [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")),
        xss: (window as unknown as { __xss?: number }).__xss ?? null,
      };
    });
    await shot(w.page, "07-hostile-description");
    const bad = dom.xss !== null || dom.iframes || dom.styles || dom.jsLinks || fetched.length;
    note(bad ? "finding" : "ok", "security", "HTML and Markdown images/links in stored text", {
      ...dom,
      remoteRequests: fetched,
      stored: (await serverIssue(id)).description.slice(0, 80),
    });
  } finally {
    await transact("ada", [{ model: "Issue", type: "delete", key: id, value: {} }]);
    await w.page.context().close();
  }
});

test("first edit after a cold 100k load: when does the server have it", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "bob"));
  const { page } = w;
  const n = 7 * data.perProject + 123;
  const key = data.ids[n - 1];
  const before = (await serverIssue(key)).priority;
  const to = before === "low" ? "Medium" : "Low";
  let responseAt = 0;
  let requestAt = 0;
  try {
    await page.goto(allIssues);
    await expect(whole(page)).toBeVisible({ timeout: 180_000 });
    await live(page);
    const shown = performance.now();
    page.on("request", (r) => {
      if (r.url().endsWith("/transactions") && !requestAt) requestAt = performance.now() - shown;
    });
    page.on("response", (r) => {
      if (r.url().endsWith("/transactions") && !responseAt) responseAt = performance.now() - shown;
    });
    await search(page, titleOf(n));
    await expect(count(page, 1)).toBeVisible({ timeout: 120_000 });
    const click = await timed(async () => {
      await row(page, titleOf(n))
        .getByLabel(/^Priority:/)
        .click();
      await expect(page.getByRole("option", { name: to, exact: true })).toBeVisible();
    });
    const pick = await timed(async () => {
      await page.getByRole("option", { name: to, exact: true }).click();
      await expect(row(page, titleOf(n)).getByLabel(`Priority: ${to}`)).toBeVisible();
    });
    const edited = performance.now();
    const server = await timed(async () => {
      await expect
        .poll(async () => (await serverIssue(key)).priority, { timeout: 300_000, intervals: [250] })
        .toBe(to.toLowerCase());
    });
    await expect.poll(() => responseAt, { timeout: 300_000 }).toBeGreaterThan(0);
    note(server.ms > 5000 ? "finding" : "ok", "persist", "first edit after a cold 100k load reaches the server", {
      openPickerMs: click.ms,
      optimisticMs: pick.ms,
      serverHasItAfterMs: server.ms,
      requestSentAfterLiveMs: Math.round(requestAt),
      responseAfterLiveMs: Math.round(responseAt),
      editMadeAfterLiveMs: Math.round(edited - shown),
    });
    await transact("ada", [{ model: "Issue", type: "update", key, value: { priority: before } }]);
  } finally {
    await page.context().close();
  }
});

test("what stays on the device after removal and after sign-out", async ({ browser }) => {
  const cookie = cookieOf(await post("/api/auth/sign-in/email", { email: "weak2@example.com", password: "aaaaaaaa" }));
  const invitation = await api("ada", "/api/auth/organization/invite-member", {
    organizationId: data.workspace.id,
    email: "weak2@example.com",
    role: "member",
    resend: true,
  });
  await post("/api/auth/organization/accept-invitation", { invitationId: invitation.json?.id }, cookie);
  const context = await browser.newContext();
  await context.addCookies(cookiesFrom(cookie));
  const g = await watch(context);
  try {
    await g.page.goto(`/${slug}/projects/${data.projects[0].id}`);
    await expect(count(g.page, data.perProject)).toBeVisible({ timeout: 180_000 });
    await live(g.page);
    // An edit and its answer: device writes before it are done.
    await search(g.page, titleOf(42));
    await row(g.page, titleOf(42))
      .getByLabel(/^Priority:/)
      .click();
    const answered = g.page.waitForResponse((r) => r.url().endsWith("/transactions"), { timeout: 120_000 });
    await g.page.getByRole("option", { name: "Medium", exact: true }).click();
    await answered;
    await g.page.waitForTimeout(3000);
    const held = await opfs(g.page);
    await api("ada", "/api/auth/organization/remove-member", {
      organizationId: data.workspace.id,
      memberIdOrEmail: "weak2@example.com",
    });
    await expect(g.page.getByText(`You no longer belong to ${data.workspace.name}.`)).toBeVisible({ timeout: 60_000 });
    await g.page.waitForTimeout(10_000);
    const afterRemoval = await opfs(g.page);
    await g.page.getByRole("button", { name: "Go to your workspaces" }).click();
    await g.page.waitForTimeout(5000);
    const afterLeaving = await opfs(g.page);
    const big = (files: Record<string, number>) =>
      Object.entries(files).some(([name, size]) => name.includes("sqlite") && size > 100_000);
    note(
      big(afterRemoval) || big(afterLeaving) ? "finding" : "ok",
      "auth",
      "a removed member's device still holds the workspace's rows",
      { held, afterRemoval, afterLeaving, landed: g.page.url() },
    );
    await transact("ada", [{ model: "Issue", type: "update", key: data.ids[41], value: { priority: "low" } }]);
  } finally {
    await context.close();
  }

  const a = await watch(await contextOf(browser, null));
  try {
    await a.page.goto("/login");
    await signIn(a.page, "cy@example.com");
    await live(a.page);
    await a.page.goto(`/${slug}/projects/${data.projects[0].id}`);
    await expect(count(a.page, data.perProject)).toBeVisible({ timeout: 180_000 });
    await a.page.waitForTimeout(15_000);
    const held = await opfs(a.page);
    await signOut(a.page);
    await a.page.waitForTimeout(4000);
    const after = await opfs(a.page);
    note(
      Object.keys(after).some((n) => n.includes("sqlite")) ? "finding" : "ok",
      "auth",
      "sign-out deletes the stored workspace",
      { held, after },
    );
  } finally {
    await a.page.context().close();
  }
});

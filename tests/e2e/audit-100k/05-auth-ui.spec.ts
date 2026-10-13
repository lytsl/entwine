import { type Page, test } from "@playwright/test";
import { layout } from "../helpers/page";
import {
  api,
  contextOf,
  cookieOf,
  cookiesFrom,
  data,
  expect,
  live,
  note,
  opfs,
  overflowPx,
  post,
  shot,
  signIn,
  signOut,
  step,
  watch,
} from "./helpers";

const slug = data.workspace.slug;
const xss = (page: Page) => page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? null);

test("signed-out visitors, forms, redirects after sign-in", async ({ browser }) => {
  const w = await watch(await contextOf(browser, null));
  const { page } = w;
  try {
    await step(w, "auth", "a signed-out visitor to an issue list is sent to sign in, with the way back", async () => {
      await page.goto(`/${slug}/issues?layout=board`);
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
      return { url: page.url() };
    });
    await shot(page, "05-login");
    await step(w, "auth", "empty and malformed sign-in is explained in the form", async () => {
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      const empty = await page.locator("form").innerText();
      await signIn(page, "not-an-email", "x");
      const malformed = await page.locator("form").innerText();
      return { empty, malformed };
    });
    await step(w, "auth", "a wrong password is refused without saying which part was wrong", async () => {
      await signIn(page, "ada@example.com", "wrong-password");
      await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    });
    await shot(page, "05-login-wrong");
    await page.waitForTimeout(11_000);
    await step(w, "auth", "sign-in returns to the page first asked for, search included", async () => {
      await signIn(page, "ada@example.com");
      await expect(page).toHaveURL(new RegExp(`/${slug}/issues\\?.*layout=board`), { timeout: 60_000 });
      return { url: page.url() };
    });

    // Sign out, then check what a stolen cookie and the Back button still give.
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    await live(page);
    await step(w, "auth", "sign out from the workspace menu", async () => {
      await signOut(page);
    });
    const replay = await fetch(`${data.origin}${data.endpoint}/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ queries: [{ model: "Project" }] }),
    });
    note(replay.status === 401 ? "ok" : "finding", "auth", "the session cookie is dead after sign-out", {
      status: replay.status,
    });
    await page.goBack();
    await page.waitForTimeout(2000);
    const afterBack = { url: page.url(), showsIssues: await page.getByTestId("issue-card").count() };
    note(afterBack.showsIssues ? "finding" : "ok", "auth", "Back after sign-out shows no workspace data", afterBack);
    const storage = {
      opfs: Object.keys(await opfs(page)),
      ...(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))),
    };
    note(storage.opfs.length ? "finding" : "ok", "auth", "stored data left in the browser after sign-out", storage);

    for (const next of ["//evil.example/", "/\\evil.example", "https://evil.example", "/%2F%2Fevil.example"]) {
      await page.waitForTimeout(4000);
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await signIn(page, "ada@example.com");
      await page.waitForTimeout(3000);
      const host = new URL(page.url()).host;
      note(host === "localhost:4100" ? "ok" : "finding", "auth", `open redirect through next=${next}`, {
        landed: page.url(),
        errors: w.errors.slice(-2),
        formText: (await page.locator("body").innerText()).slice(0, 120),
      });
      await page.context().clearCookies();
    }
    await page.goto("/signup");
    await shot(page, "05-signup");
    await step(w, "auth", "sign-up refuses a short password and a taken email, in the form", async () => {
      await page.getByLabel("Name").fill("Zed");
      await page.getByLabel("Email").fill("ada@example.com");
      await page.getByLabel("Password").fill("short");
      await page.getByRole("button", { name: "Sign up", exact: true }).click();
      const short = await page.locator("form").innerText();
      await page.getByLabel("Password").fill("password123");
      await page.getByRole("button", { name: "Sign up", exact: true }).click();
      await page.waitForTimeout(1500);
      return { short, taken: await page.locator("form").innerText() };
    });
  } finally {
    note(w.errors.length ? "finding" : "ok", "auth", "page errors (signed-out flows)", {
      errors: w.errors,
      console: w.consoleErrors.slice(0, 8),
    });
    await page.context().close();
  }
});

test("someone who is not a member, and workspaces with unusable addresses", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "dee"));
  const { page } = w;
  try {
    await step(w, "auth", "a non-member opening the workspace address", async () => {
      await page.goto(`/${slug}/issues`);
      await expect(page.getByText("This workspace does not exist, or you are not a member of it.")).toBeVisible();
    });
    await step(w, "auth", "a non-member opening an issue link", async () => {
      await page.goto(`/${slug}/issues/${data.ids[0]}`);
      await expect(page.getByText("This workspace does not exist, or you are not a member of it.")).toBeVisible();
    });
    // Dee owns workspaces created through the API with the slugs "login", "new" and "a/b?c#d".
    await page.goto("/");
    await page.waitForTimeout(4000);
    await shot(page, "05-dee-home");
    note("measure", "auth", "where a member lands whose workspace slug is 'login'", {
      url: page.url(),
      text: (await page.locator("body").innerText()).slice(0, 200),
      xss: await xss(page),
    });
    const list = (await api("dee", "/api/auth/organization/list")).json as { slug: string; name: string }[];
    const reachable: Record<string, string> = {};
    for (const org of list) {
      await page.goto(`/${encodeURIComponent(org.slug)}`);
      await page.waitForTimeout(2500);
      reachable[org.slug] =
        `${new URL(page.url()).pathname} :: ${(await page.locator("body").innerText()).slice(0, 80).replace(/\n/g, " | ")}`;
    }
    note("finding", "auth", "workspaces whose slug the server accepted but the app cannot open", {
      reachable,
      xss: await xss(page),
    });
    await shot(page, "05-dee-odd-workspace");
  } finally {
    note(w.errors.length ? "finding" : "ok", "auth", "page errors (non-member)", {
      errors: w.errors,
      console: w.consoleErrors.slice(0, 8),
    });
    await page.context().close();
  }
});

test("hostile text is shown as text; a removed member loses the workspace", async ({ browser }) => {
  // The account named "<script>alert(1)</script>" joins, so its name reaches the member directory and pickers.
  const signed = await post("/api/auth/sign-in/email", { email: "weak2@example.com", password: "aaaaaaaa" });
  const guestCookie = cookieOf(signed);
  const guestId = (await signed.json()).user.id as string;
  const invitation = await api("ada", "/api/auth/organization/invite-member", {
    organizationId: data.workspace.id,
    email: "weak2@example.com",
    role: "member",
    resend: true,
  });
  const accepted = await post(
    "/api/auth/organization/accept-invitation",
    { invitationId: invitation.json?.id },
    guestCookie,
  );
  note(accepted.ok ? "ok" : "finding", "auth", "guest accepted the invitation", {
    invite: invitation.status,
    accept: accepted.status,
    body: (await accepted.text()).slice(0, 200),
  });

  const a = await watch(await contextOf(browser, "ada"));
  const guestContext = await browser.newContext();
  await guestContext.addCookies(cookiesFrom(guestCookie));
  const g = await watch(guestContext);
  try {
    const edge = `/${slug}/projects/${data.edge.project.id}`;
    await a.page.goto(edge);
    await live(a.page);
    await expect(a.page.getByTestId("issue-row").first()).toBeVisible({ timeout: 120_000 });
    await shot(a.page, "05-edge-list");
    for (const name of ["Board", "Spreadsheet", "Timeline"] as const) {
      await layout(a.page, name);
      await a.page.waitForTimeout(800);
      await shot(a.page, `05-edge-${name}`);
    }
    const overflow = await overflowPx(a.page);
    await a.page.goto(`/${slug}/issues/${data.edge.ids[0]}`);
    await expect(a.page.getByLabel("Title")).toBeVisible({ timeout: 60_000 });
    await a.page.waitForTimeout(1500);
    await shot(a.page, "05-edge-issue-xss");
    const injected = await a.page.evaluate(
      () => document.querySelectorAll('img[src="x"], svg[onload], script:not([src]):not([type])').length,
    );
    await a.page.goto(`/${slug}/issues/${data.edge.hub}`);
    await expect(a.page.getByTestId("comment").first()).toBeVisible({ timeout: 60_000 });
    const hub = { comments: await a.page.getByTestId("comment").count(), nodes: await a.page.locator("*").count() };
    await shot(a.page, "05-hub-2000-comments");
    await a.page.goto(`/${slug}/settings/members`);
    await expect(a.page.getByText("weak2@example.com")).toBeVisible({ timeout: 60_000 });
    await shot(a.page, "05-members");
    note(
      (await xss(a.page)) === null && injected === 0 ? "ok" : "finding",
      "security",
      "stored markup in titles, descriptions and names never runs",
      {
        xss: await xss(a.page),
        injectedElements: injected,
        pageOverflowPx: overflow,
      },
    );
    note(hub.comments > 500 ? "finding" : "ok", "perf", "an issue with 2,000 comments mounts every comment", hub);

    // Removal while the guest has the workspace open.
    await g.page.goto(`/${slug}/issues`);
    await live(g.page);
    const start = performance.now();
    const removed = await api("ada", "/api/auth/organization/remove-member", {
      organizationId: data.workspace.id,
      memberIdOrEmail: "weak2@example.com",
    });
    await step(g, "auth", "a removed member is told at once and loses the view", async () => {
      await expect(g.page.getByText(`You no longer belong to ${data.workspace.name}.`)).toBeVisible({
        timeout: 60_000,
      });
      return { removeStatus: removed.status, afterMs: Math.round(performance.now() - start) };
    });
    await shot(g.page, "05-removed");
    const after = await fetch(`${data.origin}${data.endpoint}/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: guestCookie },
      body: JSON.stringify({ queries: [{ model: "Project" }] }),
    });
    await g.page.waitForTimeout(3000);
    const left = Object.keys(await opfs(g.page));
    note(after.status === 403 ? "ok" : "finding", "auth", "a removed member's requests are refused", {
      status: after.status,
    });
    note(left.length ? "finding" : "ok", "auth", "stored rows left on the device of a removed member", { opfs: left });
    await a.page.reload();
    await a.page.waitForTimeout(2000);
    note("measure", "auth", "issues assigned to or made by a removed member still name them", {
      guestId,
      membersPage: (await a.page.locator("main").innerText()).slice(0, 300),
    });
  } finally {
    note(a.errors.length || g.errors.length ? "finding" : "ok", "auth", "page errors (xss, removal)", {
      ada: a.errors,
      guest: g.errors,
      console: [...a.consoleErrors, ...g.consoleErrors].slice(0, 8),
    });
    await Promise.all([a.page.context().close(), guestContext.close()]);
  }
});

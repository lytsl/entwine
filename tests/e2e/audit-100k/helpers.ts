import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type BrowserContext, type CDPSession, expect, type Page } from "@playwright/test";
import { sidebar } from "../helpers/page";
import { auditTitle } from "../helpers/seed";

export { expect };

const results = process.env.AUDIT_RESULTS ?? join(import.meta.dirname, "../audit-results/100k");

interface Account {
  name: string;
  email: string;
  id: string;
  cookie: string;
}
export interface Dataset {
  origin: string;
  workspace: { id: string; slug: string; name: string };
  other: { id: string; slug: string; name: string };
  endpoint: string;
  today: string;
  users: Record<"ada" | "bob" | "cy" | "dee" | "eve", Account>;
  members: string[];
  labels: { id: string; name: string }[];
  projects: { id: string; name: string; identifier: string }[];
  cycles: { id: string; projectId: string; name: string }[];
  modules: { id: string; projectId: string; name: string }[];
  edge: { project: { id: string; name: string }; ids: string[]; titles: string[]; hub: string };
  issueCount: number;
  perProject: number;
  seedMs: number;
  timings: { issues: number; ms: number }[];
  ids: string[];
}
export const data: Dataset = JSON.parse(readFileSync(process.env.AUDIT_DATASET ?? "dataset.json", "utf8"));
/** The ten uniform projects' issues plus the edge project's. */
export const TOTAL = data.issueCount + data.edge.ids.length + 1;
export const titleOf = (n: number) => auditTitle(n, 6);

/** One line per observation, appended as the specs run: a measurement, or something that looks wrong. */
export function note(kind: "measure" | "finding" | "ok", area: string, title: string, detail: unknown = null) {
  const line = { at: new Date().toISOString(), kind, area, title, detail };
  appendFileSync(join(results, "..", "notes-100k.jsonl"), `${JSON.stringify(line)}\n`);
  console.log(`[${kind}] ${area}: ${title}${detail == null ? "" : ` ${JSON.stringify(detail).slice(0, 600)}`}`);
}

export const cookiesFrom = (cookie: string) =>
  cookie.split("; ").map((pair) => {
    const at = pair.indexOf("=");
    return { name: pair.slice(0, at), value: pair.slice(at + 1), domain: "localhost", path: "/" };
  });

export async function contextOf(browser: Browser, name: keyof Dataset["users"] | null): Promise<BrowserContext> {
  const context = await browser.newContext();
  if (name) await context.addCookies(cookiesFrom(data.users[name].cookie));
  return context;
}

export interface Watched {
  page: Page;
  errors: string[];
  consoleErrors: string[];
  failed: string[];
  cdp: CDPSession;
}

export async function watch(context: BrowserContext): Promise<Watched> {
  const page = await context.newPage();
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 400));
  });
  page.on("response", (response) => {
    if (response.status() >= 500) failed.push(`${response.status()} ${response.url()}`);
  });
  page.on("crash", () => errors.push("PAGE CRASHED"));
  await page.addInitScript(() => {
    const tasks: number[] = [];
    Object.assign(window, { auditLongTasks: tasks });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) tasks.push(Math.round(e.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  return { page, errors, consoleErrors, failed, cdp };
}

/** Long tasks since the last call, and the renderer's heap after a forced collection. */
export async function sample(w: Watched) {
  const tasks = await w.page.evaluate(() =>
    ((window as unknown as { auditLongTasks?: number[] }).auditLongTasks ?? []).splice(0),
  );
  await w.cdp.send("HeapProfiler.collectGarbage");
  const heap = await w.cdp.send("Runtime.getHeapUsage");
  const dom = await w.cdp.send("Memory.getDOMCounters");
  return {
    heapMB: Math.round(heap.usedSize / 1048576),
    domNodes: dom.nodes,
    longTasks: tasks.length,
    longTaskTotalMs: tasks.reduce((a, b) => a + b, 0),
    longestTaskMs: Math.max(0, ...tasks),
  };
}

export async function timed<T>(run: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await run();
  return { ms: Math.round(performance.now() - start), value };
}

export const count = (page: Page, n: number) => page.getByTitle(`${n} issue${n === 1 ? "" : "s"}`, { exact: true });
/** The all-issues count once the whole workspace is held; other specs add and delete a few issues. */
export const whole = (page: Page) => page.getByTitle(/^1000\d\d issues$/);
export const live = (page: Page) => expect(page.getByTestId("sync-status")).toHaveText("Live", { timeout: 600_000 });
export const allIssues = `/${data.workspace.slug}/issues`;
export const projectUrl = (n: number) => `/${data.workspace.slug}/projects/${data.projects[n].id}`;
export const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(results, "..", "shots-100k", `${name}.png`) }).catch(() => {});

/** A failure is a finding with a screenshot, not the end of the spec. */
export async function step(w: Watched, area: string, title: string, run: () => Promise<unknown>): Promise<boolean> {
  try {
    const { ms, value } = await timed(run);
    note("measure", area, title, { ms, ...(value && typeof value === "object" ? value : {}) });
    return true;
  } catch (error) {
    await shot(w.page, `fail-${area}-${title.replace(/\W+/g, "-").slice(0, 60)}`);
    note(
      "finding",
      area,
      `FAILED: ${title}`,
      String(error)
        .replace(/\u001b\[\d+m/g, "")
        .slice(0, 700),
    );
    return false;
  }
}

export async function api(name: keyof Dataset["users"], path: string, body?: unknown) {
  const response = await fetch(`${data.origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Origin: data.origin, Cookie: data.users[name].cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, text };
}
export const serverIssue = async (id: string) =>
  (await api("ada", `${data.endpoint}/load`, { queries: [{ model: "Issue", where: { id } }] })).json.rows.Issue[0];
export const transact = (name: keyof Dataset["users"], mutations: unknown[]) =>
  api(name, `${data.endpoint}/transactions`, { id: crypto.randomUUID(), mutations });
export const post = (path: string, body: unknown, cookie = "") =>
  fetch(`${data.origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: data.origin, ...(cookie && { Cookie: cookie }) },
    body: JSON.stringify(body),
  });
export const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
export async function signIn(page: Page, email: string, password = "password123") {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
export async function signOut(page: Page) {
  await sidebar(page).getByRole("button", { name: data.workspace.name, exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
}
export const opfs = (page: Page) =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const out: Record<string, number> = {};
    for await (const [name, handle] of root.entries())
      out[name] = handle.kind === "file" ? (await handle.getFile()).size : -1;
    return out;
  });
export const overflowPx = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
export const toasts = (page: Page) => page.locator("[data-slot=toast]").allTextContents();

/** Findings go to SWEEP_OUT as JSON lines; a failed step is a line to read, not the end of the run. */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { heading } from "../helpers/page";

const out = process.env.SWEEP_OUT ?? "sweep-out";
mkdirSync(join(out, "shots"), { recursive: true });
const record = (line: unknown) => appendFileSync(join(out, "findings.jsonl"), `${JSON.stringify(line)}\n`);

const VIEWPORTS = {
  reflow: { width: 320, height: 640 },
  phone: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;
const only = process.env.SWEEP_ONLY?.split(",");
const stateFilter = process.env.SWEEP_STATES ? new RegExp(process.env.SWEEP_STATES) : null;

/** What the layout does that a narrow or zoomed screen cannot use. */
const probe = (page: Page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const describe = (el: Element) => {
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} "${name}"`;
    };
    const scrollsX = (el: Element) => /(auto|scroll)/.test(getComputedStyle(el).overflowX);
    const scrollsY = (el: Element) => /(auto|scroll)/.test(getComputedStyle(el).overflowY);
    const clipped: string[] = [];
    const small: string[] = [];
    const controls = document.querySelectorAll(
      'a[href], button, input, select, textarea, [role=button], [role=checkbox], [role=radio], [role=tab], [role=menuitem], [role=combobox], [role=switch], [tabindex="0"]',
    );
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (el.closest("[inert], [aria-hidden=true]")) continue;
      let reachX = false;
      let reachY = false;
      let cutBy: Element | null = null;
      for (let a = el.parentElement; a; a = a.parentElement) {
        if (scrollsX(a)) reachX = true;
        if (scrollsY(a)) reachY = true;
        const ar = a.getBoundingClientRect();
        const o = getComputedStyle(a);
        if (!reachX && /(hidden|clip)/.test(o.overflowX) && (r.right > ar.right + 1 || r.left < ar.left - 1))
          cutBy ??= a;
      }
      if (!reachX && (r.right > vw + 1 || r.left < -1 || cutBy)) {
        clipped.push(`${describe(el)} x=${Math.round(r.left)}..${Math.round(r.right)} vw=${vw}`);
      }
      if (!reachY && (r.bottom > vh + 1 || r.top < -1) && style.position !== "fixed") {
        clipped.push(`${describe(el)} y=${Math.round(r.top)}..${Math.round(r.bottom)} vh=${vh}`);
      }
      if ((r.width < 24 || r.height < 24) && !(el instanceof HTMLInputElement && el.type === "hidden")) {
        // Inline links in text are exempt from target size.
        if (!(el.tagName === "A" && style.display === "inline"))
          small.push(`${describe(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    // Text cut by its own box with no way to read the rest.
    const truncated: string[] = [];
    for (const el of document.querySelectorAll("h1, h2, h3, label, button, a, th, [role=tab]")) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === "hidden" && el.clientWidth < 48) {
        truncated.push(`${describe(el)} ${el.clientWidth}/${el.scrollWidth}`);
      }
    }
    const tiny: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || seen.has(parent) || !walker.currentNode.textContent?.trim()) continue;
      seen.add(parent);
      const size = Number.parseFloat(getComputedStyle(parent).fontSize);
      if (size < 11 && parent.getBoundingClientRect().width > 0) tiny.push(`${describe(parent)} ${size}px`);
    }
    return {
      pageScrollsX: document.documentElement.scrollWidth > vw + 1,
      scrollWidth: document.documentElement.scrollWidth,
      vw,
      title: document.title,
      h1: [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim()),
      landmarks: [...document.querySelectorAll("main, [role=main]")].length,
      clipped: [...new Set(clipped)].slice(0, 25),
      small: [...new Set(small)].slice(0, 40),
      smallCount: small.length,
      truncated: [...new Set(truncated)].slice(0, 15),
      tiny: [...new Set(tiny)].slice(0, 15),
    };
  });

async function audit(page: Page, viewport: string, theme: string, state: string) {
  // Let transitions and the virtual lists settle.
  await page.waitForTimeout(350);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const layout = await probe(page);
  await page.screenshot({ path: join(out, "shots", `${viewport}-${theme}-${state}.png`) });
  record({
    viewport,
    theme,
    state,
    url: new URL(page.url()).pathname,
    layout,
    violations: axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      count: v.nodes.length,
      nodes: v.nodes.slice(0, 6).map((n) => ({
        target: n.target.join(" "),
        html: n.html.slice(0, 220),
        why: (n.any[0]?.message ?? n.all[0]?.message ?? n.none[0]?.message ?? "").slice(0, 260),
      })),
    })),
    incomplete: axe.incomplete
      .filter((v) => v.id !== "color-contrast" || v.nodes.length > 0)
      .map((v) => ({ id: v.id, count: v.nodes.length, first: v.nodes[0]?.html.slice(0, 160) })),
  });
}

async function newPage(browser: Browser, viewport: keyof typeof VIEWPORTS, theme: string, signedIn: boolean) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    hasTouch: viewport === "phone" || viewport === "reflow",
    isMobile: viewport === "phone" || viewport === "reflow",
    storageState: signedIn ? join(out, "ada.json") : undefined,
  });
  await context.addInitScript((t) => localStorage.setItem("entwine:theme", t), theme);
  return context.newPage();
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("sync-status")).toHaveText("Live");
  await context.storageState({ path: join(out, "ada.json") });
  await context.close();
});

// The sync status sits in the sidebar, which a narrow screen keeps closed: the page's heading is there on both.
const live = (page: Page) => expect(heading(page)).toBeVisible({ timeout: 30_000 });

for (const viewport of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
  for (const theme of ["dark", "light"]) {
    if (only && !only.includes(`${viewport}-${theme}`)) continue;
    test(`${viewport} ${theme}`, async ({ browser }) => {
      test.setTimeout(15 * 60_000);
      const step = async (page: Page, state: string, run: () => Promise<unknown>) => {
        if (stateFilter && !stateFilter.test(state)) return;
        try {
          await run();
          await audit(page, viewport, theme, state);
        } catch (error) {
          await page.screenshot({ path: join(out, "shots", `FAIL-${viewport}-${theme}-${state}.png`) }).catch(() => {});
          record({
            viewport,
            theme,
            state,
            failed: String(error)
              .replace(/\u001b\[\d+m/g, "")
              .slice(0, 500),
          });
        }
        // Overlays left open by a state must not leak into the next.
        for (let i = 0; i < 3; i++) await page.keyboard.press("Escape").catch(() => {});
      };

      const anon = await newPage(browser, viewport, theme, false);
      await step(anon, "login", () => anon.goto("/login"));
      await step(anon, "login-error", async () => {
        await anon.goto("/login");
        await anon.getByRole("button", { name: "Sign in" }).click();
      });
      await step(anon, "signup", () => anon.goto("/signup"));
      await step(anon, "root-not-found", () => anon.goto("/no/such/page/at/all"));
      await anon.context().close();

      const page = await newPage(browser, viewport, theme, true);
      const narrow = VIEWPORTS[viewport].width < 768;
      const go = async (path: string) => {
        await page.goto(path);
        await live(page);
      };
      const layoutOf = async (name: string) => {
        await page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name, exact: true }).click();
      };

      await step(page, "new-workspace", () => page.goto("/new"));
      await step(page, "workspace-not-found", () => page.goto("/nope-nope"));
      await step(page, "all-issues-list", async () => {
        await go("/acme/issues");
        await layoutOf("List");
      });
      await go("/acme/projects");
      // Website is the seeded project with cycles and modules.
      const project = await page
        .getByRole("main")
        .getByRole("link", { name: /Website/ })
        .first()
        .getAttribute("href");
      if (!project) throw new Error("no Website project: seed the demo workspace");

      await step(page, "sidebar-open", async () => {
        await go("/acme/issues");
        if (narrow)
          await page
            .getByRole("button", { name: /sidebar/i })
            .first()
            .click();
        await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
      });
      for (const name of ["Board", "Spreadsheet", "Calendar", "Timeline"]) {
        await step(page, `all-issues-${name.toLowerCase()}`, async () => {
          await go("/acme/issues");
          await layoutOf(name);
        });
      }
      await step(page, "project-list", async () => {
        await go(project);
        await layoutOf("List");
      });
      await step(page, "filters-panel", async () => {
        await go(project);
        await page.getByRole("button", { name: "Filters" }).click();
        await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
      });
      await step(page, "display-panel", async () => {
        await go(project);
        await page.getByRole("button", { name: "Display" }).click();
        await expect(page.getByRole("dialog", { name: "Display" })).toBeVisible();
      });
      await step(page, "search-open", async () => {
        await go(project);
        await page.keyboard.press("/");
        await page.getByLabel("Search issues").fill("page");
      });
      await step(page, "peek", async () => {
        await go(project);
        await layoutOf("List");
        await page.getByTestId("issue-row").first().getByRole("link").first().click();
        await expect(page.getByRole("complementary", { name: "Issue preview" })).toBeVisible();
      });
      await step(page, "issue-page", async () => {
        await go(project);
        await layoutOf("List");
        await page.getByTestId("issue-row").first().getByRole("link").first().click();
        await page.getByRole("link", { name: "Open issue page" }).click();
        await expect(page).toHaveURL(/\/issues\/[\w-]+$/);
        await page.waitForTimeout(500);
      });
      await step(page, "selection-bulk-bar", async () => {
        await go(project);
        await layoutOf("List");
        await page.getByTestId("issue-row").first().getByRole("checkbox").first().click({ force: true });
      });
      await step(page, "new-issue-dialog", async () => {
        await go(project);
        await page.keyboard.press("c");
        await expect(page.getByRole("dialog")).toBeVisible();
      });
      await step(page, "new-issue-invalid", async () => {
        await go(project);
        await page.keyboard.press("c");
        await page.getByRole("button", { name: "Create issue" }).click();
      });
      await step(page, "palette", async () => {
        await go(project);
        await page.keyboard.press("Control+k");
        await expect(page.getByRole("dialog")).toBeVisible();
      });
      await step(page, "shortcut-help", async () => {
        await go(project);
        await page.keyboard.press("?");
        await expect(page.getByRole("dialog")).toBeVisible();
      });
      await step(page, "workspace-menu", async () => {
        await go(project);
        if (narrow)
          await page
            .getByRole("button", { name: /sidebar/i })
            .first()
            .click();
        await page.getByRole("navigation", { name: "Workspace" }).getByRole("button").first().click();
        await expect(page.getByRole("menu")).toBeVisible();
      });
      await step(page, "new-project-dialog", async () => {
        await go("/acme/projects");
        await page.getByRole("button", { name: "New project" }).last().click();
        await expect(page.getByRole("dialog")).toBeVisible();
      });
      for (const [state, path] of [
        ["projects", "/acme/projects"],
        ["cycles", `${project}/cycles`],
        ["modules", `${project}/modules`],
        ["archives", `${project}/archives`],
        ["project-settings", `${project}/settings`],
        ["views", "/acme/views"],
        ["labels", "/acme/settings/labels"],
        ["members", "/acme/settings/members"],
        ["home", "/acme"],
      ] as const) {
        await step(page, state, async () => {
          await go(path);
        });
      }
      for (const [state, list, pattern] of [
        ["cycle-detail", `${project}/cycles`, /\/cycles\/[\w-]+$/],
        ["module-detail", `${project}/modules`, /\/modules\/[\w-]+$/],
        ["view-detail", "/acme/views", /\/views\/[\w-]+$/],
      ] as const) {
        await step(page, state, async () => {
          await go(list);
          const href = await page.evaluate(
            (source) =>
              [...document.querySelectorAll("a[href]")]
                .map((a) => a.getAttribute("href") ?? "")
                .find((h) => new RegExp(source).test(h)),
            pattern.source,
          );
          if (!href) throw new Error("no link");
          await go(href);
        });
      }
      await page.context().close();
    });
  }
}

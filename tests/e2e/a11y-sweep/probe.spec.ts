/**
 * What axe cannot see: the keyboard's path and whether focus shows, what a touch screen hides, what a screen reader
 * is told (aria snapshots, live regions, form errors), and motion.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { heading } from "../helpers/page";

const out = process.env.SWEEP_OUT ?? "sweep-out";
mkdirSync(join(out, "probe"), { recursive: true });
const save = (name: string, value: unknown) =>
  writeFileSync(join(out, "probe", name), typeof value === "string" ? value : JSON.stringify(value, null, 1));

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(heading(page)).toBeVisible();
}

const website = async (page: Page) => {
  await page.goto("/acme/projects");
  const href = await page
    .getByRole("main")
    .getByRole("link", { name: /Website/ })
    .first()
    .getAttribute("href");
  if (!href) throw new Error("no Website project");
  return href;
};

/** Tabs through the page, noting each stop: what it is, whether it can be seen, and whether focus shows on it. */
async function tabWalk(page: Page, limit: number) {
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  const stops: unknown[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { what: "body" };
      const read = (e: Element) => {
        const s = getComputedStyle(e);
        return [
          s.outlineStyle,
          s.outlineWidth,
          s.outlineColor,
          s.boxShadow,
          s.borderColor,
          s.backgroundColor,
          s.textDecorationLine,
          s.color,
        ].join("|");
      };
      // A focus style may be drawn by an ancestor (`focus-within`, a row's `data-focused`).
      const chain = [el, el.parentElement, el.parentElement?.parentElement].filter(Boolean) as Element[];
      const focused = chain.map(read);
      const r = el.getBoundingClientRect();
      let opacity = 1;
      for (let a: Element | null = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
      el.blur();
      const blurred = chain.map(read);
      el.focus({ focusVisible: true } as FocusOptions);
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? (el as HTMLInputElement).placeholder ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 50);
      return {
        what: `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""} "${name}"`,
        shows: focused.some((f, i) => f !== blurred[i]),
        opacity,
        box: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`,
        onScreen: r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && r.width > 0,
      };
    });
    stops.push(stop);
  }
  return stops;
}

test("keyboard and semantics, desktop", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Form errors, signed out.
  await page.goto("/login");
  save("tab-login.json", await tabWalk(page, 6));
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(500);
  save("aria-login-empty.yml", await page.locator("body").ariaSnapshot());
  save(
    "login-empty-fields.json",
    await page.evaluate(() =>
      [...document.querySelectorAll("input")].map((i) => ({
        name: i.name,
        type: i.type,
        autocomplete: i.autocomplete,
        required: i.required,
        ariaRequired: i.getAttribute("aria-required"),
        invalid: i.getAttribute("aria-invalid"),
        describedby: i.getAttribute("aria-describedby"),
        described: (i.getAttribute("aria-describedby") ?? "")
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent)
          .join(" / "),
        focused: document.activeElement === i,
      })),
    ),
  );
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1500);
  save("aria-login-wrong.yml", await page.locator("body").ariaSnapshot());
  save(
    "login-wrong-live.json",
    await page.evaluate(() =>
      [...document.querySelectorAll("[role=alert], [role=status], [aria-live]")].map((e) => ({
        role: e.getAttribute("role"),
        live: e.getAttribute("aria-live"),
        text: e.textContent?.slice(0, 120),
      })),
    ),
  );
  await page.goto("/signup");
  save(
    "signup-fields.json",
    await page.evaluate(() =>
      [...document.querySelectorAll("input")].map((i) => ({
        name: i.name,
        type: i.type,
        autocomplete: i.autocomplete,
      })),
    ),
  );

  await signIn(page);
  const project = await website(page);

  for (const [name, path, layout] of [
    ["list", project, "List"],
    ["board", project, "Board"],
    ["spreadsheet", project, "Spreadsheet"],
    ["calendar", project, "Calendar"],
    ["timeline", project, "Timeline"],
  ] as const) {
    await page.goto(path);
    await page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name: layout, exact: true }).click();
    await page.waitForTimeout(500);
    save(`aria-${name}.yml`, await page.locator("body").ariaSnapshot());
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "Layout" })).toBeVisible();
    await page.waitForTimeout(500);
    save(`tab-${name}.json`, await tabWalk(page, 70));
  }
  for (const [name, path] of [
    ["projects", "/acme/projects"],
    ["cycles", `${project}/cycles`],
    ["modules", `${project}/modules`],
    ["settings", `${project}/settings`],
    ["labels", "/acme/settings/labels"],
    ["members", "/acme/settings/members"],
    ["views", "/acme/views"],
    ["home", "/acme"],
  ] as const) {
    await page.goto(path);
    await page.waitForTimeout(900);
    save(`aria-${name}.yml`, await page.getByRole("main").ariaSnapshot());
    save(`tab-${name}.json`, await tabWalk(page, 45));
  }

  await page.goto(project);
  await page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name: "List", exact: true }).click();
  await page
    .getByTestId("issue-row")
    .filter({ hasText: "Redesign the landing page" })
    .getByRole("link")
    .first()
    .click();
  const panel = page.getByRole("complementary", { name: "Issue preview" });
  await expect(panel).toBeVisible();
  save("aria-peek.yml", await panel.ariaSnapshot());
  save("peek-focus.json", await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200)));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  save("peek-closed-focus.json", await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200)));
  await page
    .getByTestId("issue-row")
    .filter({ hasText: "Redesign the landing page" })
    .getByRole("link")
    .first()
    .click();
  await panel.getByRole("link", { name: "Open issue page" }).click();
  await expect(page).toHaveURL(/\/issues\/[\w-]+$/);
  await page.waitForTimeout(800);
  save("aria-issue.yml", await page.getByRole("main").ariaSnapshot());
  save("tab-issue.json", await tabWalk(page, 70));

  // Overlays: where focus goes, and where it returns.
  const focusOf = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      return el
        ? `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}" in-dialog=${!!el.closest("[role=dialog]")}`
        : null;
    });
  const overlays: Record<string, unknown> = {};
  await page.goto(project);
  await page.waitForTimeout(600);
  const newIssue = page.getByRole("main").getByRole("button", { name: "New issue" }).first();
  await newIssue.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  overlays.newIssueOpen = await focusOf();
  save("aria-new-issue.yml", await page.getByRole("dialog").ariaSnapshot());
  await page.getByRole("button", { name: "Create issue" }).click();
  await page.waitForTimeout(400);
  overlays.newIssueInvalid = await focusOf();
  save("aria-new-issue-invalid.yml", await page.getByRole("dialog").ariaSnapshot());
  save(
    "new-issue-invalid-fields.json",
    await page.evaluate(() =>
      [...document.querySelectorAll("[role=dialog] input, [role=dialog] textarea")].map((i) => ({
        label: i.getAttribute("aria-label") ?? (i as HTMLInputElement).labels?.[0]?.textContent,
        invalid: i.getAttribute("aria-invalid"),
        describedby: i.getAttribute("aria-describedby"),
        described: (i.getAttribute("aria-describedby") ?? "")
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent)
          .join(" / "),
      })),
    ),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  overlays.newIssueClosed = await focusOf();
  for (const [name, button] of [
    ["filters", "Filters"],
    ["display", "Display"],
  ] as const) {
    await page.getByRole("button", { name: button }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: button })).toBeVisible();
    overlays[`${name}Open`] = await focusOf();
    save(`aria-${name}.yml`, await page.getByRole("dialog", { name: button }).ariaSnapshot());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    overlays[`${name}Closed`] = await focusOf();
  }
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  overlays.paletteOpen = await focusOf();
  save("aria-palette.yml", await page.getByRole("dialog").ariaSnapshot());
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog")).toBeVisible();
  save("aria-shortcuts.yml", await page.getByRole("dialog").ariaSnapshot());
  await page.keyboard.press("Escape");
  save("overlays.json", overlays);

  // What is announced: the regions that speak, and a toast.
  save(
    "live-regions.json",
    await page.evaluate(() =>
      [...document.querySelectorAll("[role=alert], [role=status], [aria-live], [role=log]")].map((e) => ({
        tag: e.tagName,
        role: e.getAttribute("role"),
        live: e.getAttribute("aria-live"),
        label: e.getAttribute("aria-label"),
        text: e.textContent?.slice(0, 80),
      })),
    ),
  );
  save("aria-sidebar.yml", await page.getByRole("navigation", { name: "Workspace" }).ariaSnapshot());
  save(
    "landmarks.json",
    await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          "main, nav, aside, header, footer, section[aria-label], [role=navigation], [role=main], [role=complementary], [role=banner], [role=region], [role=search]",
        ),
      ].map(
        (e) =>
          `${e.tagName.toLowerCase()}${e.getAttribute("role") ? `[${e.getAttribute("role")}]` : ""} "${e.getAttribute("aria-label") ?? ""}"`,
      ),
    ),
  );

  // Motion: what still moves when the system asks for less.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(project);
  await page.waitForTimeout(600);
  save(
    "motion.json",
    await page.evaluate(() => {
      const moving = new Map<string, number>();
      for (const el of document.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        const t = Math.max(
          ...s.transitionDuration.split(",").map((d) => Number.parseFloat(d) * (d.includes("ms") ? 1 : 1000)),
        );
        const a = Math.max(
          ...s.animationDuration.split(",").map((d) => Number.parseFloat(d) * (d.includes("ms") ? 1 : 1000)),
        );
        if (t > 0 && /transform|all|translate|scale|width|height|left|top/.test(s.transitionProperty)) {
          const key = `transition ${s.transitionProperty} ${t}ms`;
          moving.set(key, (moving.get(key) ?? 0) + 1);
        }
        if (a > 0 && s.animationName !== "none") {
          const key = `animation ${s.animationName} ${a}ms`;
          moving.set(key, (moving.get(key) ?? 0) + 1);
        }
      }
      return {
        rules: [...document.styleSheets].flatMap((sheet) => {
          try {
            return [...sheet.cssRules].filter((r) => r.cssText.includes("prefers-reduced-motion")).length;
          } catch {
            return [];
          }
        }),
        moving: Object.fromEntries(moving),
      };
    }),
  );
  await context.close();
});

test("touch", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await signIn(page);
  const project = await website(page);
  const hidden: Record<string, unknown> = {};
  for (const layout of ["List", "Board", "Spreadsheet", "Calendar", "Timeline"]) {
    await page.goto(project);
    await page.getByRole("radiogroup", { name: "Layout" }).getByRole("radio", { name: layout, exact: true }).click();
    await page.waitForTimeout(500);
    hidden[layout] = await page.evaluate(() => {
      const found = new Map<string, number>();
      for (const el of document.querySelectorAll(
        "a[href], button, input, [role=checkbox], [role=button], [draggable=true]",
      )) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        let opacity = 1;
        for (let a: Element | null = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
        const name = (el.getAttribute("aria-label") ?? el.textContent ?? "")
          .trim()
          .replace(/[A-Z]+-\d+|\d+/g, "#")
          .slice(0, 40);
        if (opacity === 0)
          found.set(
            `invisible until hover: ${el.tagName.toLowerCase()} "${name}"`,
            1 + (found.get(`invisible until hover: ${el.tagName.toLowerCase()} "${name}"`) ?? 0),
          );
        if (el.getAttribute("draggable") === "true")
          found.set(
            `draggable: ${el.tagName.toLowerCase()}`,
            1 + (found.get(`draggable: ${el.tagName.toLowerCase()}`) ?? 0),
          );
      }
      return {
        found: Object.fromEntries(found),
        hoverMedia: matchMedia("(hover: hover)").matches,
        touchAction: [...document.querySelectorAll("[draggable=true]")]
          .slice(0, 1)
          .map((e) => getComputedStyle(e).touchAction),
      };
    });
  }
  save("touch-hidden.json", hidden);
  // The sync status, and what else only the closed sidebar holds.
  await page.goto(project);
  await page.waitForTimeout(500);
  save("touch-status.json", {
    statusVisible: await page
      .getByTestId("sync-status")
      .isVisible()
      .catch(() => false),
    viewportMeta: await page.evaluate(() => document.querySelector("meta[name=viewport]")?.getAttribute("content")),
  });
  // Text fields under 16px make iOS Safari zoom the page on focus.
  await page.keyboard.press("c");
  await page.waitForTimeout(400);
  save(
    "touch-inputs.json",
    await page.evaluate(() =>
      [
        ...document.querySelectorAll("input:not([type=checkbox]):not([type=hidden]), textarea, [contenteditable=true]"),
      ].map((i) => ({
        what: (i.getAttribute("aria-label") ?? (i as HTMLInputElement).placeholder ?? i.tagName).slice(0, 30),
        fontSize: getComputedStyle(i).fontSize,
      })),
    ),
  );
  await context.close();
});

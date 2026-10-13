import { type Page, test } from "@playwright/test";
import { choose, createIssue, filter, heading, layout, peek, row, search, sidebar } from "../helpers/page";
import {
  contextOf,
  count,
  data,
  expect,
  live,
  note,
  overflowPx,
  projectUrl,
  sample,
  serverIssue,
  shot,
  step,
  toasts,
  watch,
  whole,
} from "./helpers";

const slug = data.workspace.slug;
const P = 6;
const stamp = Date.now().toString(36).slice(-5);

test("a member's day: landing, palette, creating and editing issues, discussion, structure", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "ada"));
  const { page } = w;
  const s = (title: string, run: () => Promise<unknown>) => step(w, "flow", title, run);
  try {
    await s("landing on the workspace (My issues) for the first time", async () => {
      await page.goto("/");
      await live(page);
      await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 180_000 });
      return { url: page.url(), heading: await heading(page).textContent(), ...(await sample(w)) };
    });
    await shot(page, "06-my-issues");
    await s("command palette finds one issue among 100,000 by title", async () => {
      await page.keyboard.press("ControlOrMeta+k");
      const palette = page.getByRole("dialog");
      await palette.getByRole("combobox").fill("Audit issue 077777");
      await expect(palette.getByRole("option", { name: /Audit issue 077777/ })).toBeVisible({ timeout: 60_000 });
      return sample(w);
    });
    await shot(page, "06-palette");
    await s("palette: typing a key jumps to the issue", async () => {
      await page.getByRole("dialog").getByRole("combobox").fill("AUD3-4242");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("option", { name: /AUD3-4242/ })
          .first(),
      ).toBeVisible({ timeout: 60_000 });
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/issues\/[\w-]+$/);
      await expect(heading(page)).toHaveText("AUD3-4242");
    });
    await shot(page, "06-issue-page");
    await s("shortcut help opens with ?", async () => {
      await page.getByRole("navigation", { name: "Breadcrumb" }).click();
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog")).toBeVisible();
    });
    await shot(page, "06-shortcuts");
    await page.keyboard.press("Escape");

    await page.goto(projectUrl(P));
    await expect(count(page, data.perProject)).toBeVisible({ timeout: 180_000 });
    const title = `Flow issue ${stamp}`;
    await s("new issue dialog refuses an empty title and says so", async () => {
      await page.keyboard.press("c");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: /^Create issue/ }).click();
      await page.waitForTimeout(500);
      const stillOpen = await dialog.count();
      const text = await dialog.innerText();
      await shot(page, "06-new-issue-empty");
      await page.keyboard.press("Escape");
      return { stillOpen, text: text.slice(0, 300) };
    });
    await s("create an issue with the keyboard (C, type, Ctrl+Enter)", async () => {
      await page.keyboard.press("c");
      await page.getByRole("dialog").getByLabel("Title").fill(title);
      await page.keyboard.press("ControlOrMeta+Enter");
      await expect(page.getByRole("dialog", { name: "New issue" })).toHaveCount(0);
      return { toasts: await toasts(page) };
    });
    await s("the new issue is findable at once", async () => {
      await search(page, title);
      await expect(row(page, title)).toBeVisible();
    });
    const panel = page.getByRole("complementary", { name: "Issue preview" });
    await s("peek, set state, priority, assignee, dates from the panel", async () => {
      await peek(page, title);
      await choose(page, panel.getByLabel(/^State:/), "In Progress");
      await choose(page, panel.getByLabel(/^Priority:/), "High");
      await choose(page, panel.getByLabel(/^Assignee/), "Bob");
      await expect(row(page, title).getByLabel("State: In Progress")).toBeVisible();
    });
    await shot(page, "06-peek");
    await s("write a description and a comment", async () => {
      await panel.getByLabel("Description").click();
      await page.keyboard.type("Steps to reproduce:\n- open the list\n- **scroll**");
      await panel.getByLabel("Title").click();
      await panel.getByLabel("Comment", { exact: true }).fill("First comment <b>not bold</b>");
      await panel.getByRole("button", { name: "Comment", exact: true }).click();
      await expect(panel.getByTestId("comment").filter({ hasText: "First comment" })).toBeVisible();
      return { description: (await serverIssue(new URL(page.url()).searchParams.get("peek") ?? "")).description };
    });
    await s("add a sub-issue and a link", async () => {
      await panel
        .getByLabel("Sub-issue title")
        .or(panel.getByRole("button", { name: /sub-issue/i }))
        .first()
        .click();
      await panel.getByLabel("Sub-issue title").fill(`Child of ${stamp}`);
      await panel.getByLabel("Sub-issue title").press("Enter");
      await expect(panel.getByRole("list", { name: "Sub-issues" }).getByText(`Child of ${stamp}`)).toBeVisible();
    });
    await shot(page, "06-peek-filled");
    await s("a link that is not http(s) is refused in the form", async () => {
      await panel.getByRole("button", { name: /add link/i }).click();
      await page.getByLabel("URL").fill("javascript:alert(1)");
      await page.getByLabel("URL").press("Enter");
      await page.waitForTimeout(600);
      const text = (await page.locator("body").innerText()).match(/http or https[^\n]*/)?.[0] ?? null;
      await shot(page, "06-bad-link");
      await page.keyboard.press("Escape");
      return { message: text };
    });
    await page.keyboard.press("Escape");
    await s("delete the issue from the keyboard, with confirmation, then undo", async () => {
      await page.getByRole("navigation", { name: "Breadcrumb" }).click();
      await page.keyboard.press("j");
      await page.keyboard.press("ControlOrMeta+Backspace");
      await page.waitForTimeout(500);
      const dialog = (
        await page
          .getByRole("alertdialog")
          .or(page.getByRole("dialog"))
          .first()
          .innerText()
          .catch(() => "NO DIALOG")
      ).slice(0, 200);
      await shot(page, "06-delete-confirm");
      await page.keyboard.press("Escape");
      return { dialog };
    });
    await page
      .getByLabel("Search issues")
      .press("Escape")
      .catch(() => {});

    await s("drag a card to another board column among 10,000", async () => {
      await layout(page, "Board");
      const card = page.getByTestId("issue-card").first();
      const id = await card.getAttribute("data-issue-id");
      await card.dragTo(page.getByRole("region", { name: "Done" }));
      await expect.poll(async () => (await serverIssue(id!)).stateId, { timeout: 15_000 }).toContain(":completed");
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(async () => (await serverIssue(id!)).stateId, { timeout: 15_000 }).not.toContain(":completed");
    });
    await shot(page, "06-board-10k");
    await layout(page, "List");

    await s("cycles page of a project whose cycle holds 6,667 issues", async () => {
      await sidebar(page).getByRole("link", { name: "Cycles", exact: true }).click();
      await expect(page.getByText(data.cycles[P].name).first()).toBeVisible({ timeout: 60_000 });
      return sample(w);
    });
    await shot(page, "06-cycles");
    await s("open the cycle", async () => {
      await page.getByRole("link", { name: data.cycles[P].name, exact: true }).click();
      await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 60_000 });
      return sample(w);
    });
    await shot(page, "06-cycle-detail");
    await s("modules page and module", async () => {
      await sidebar(page).getByRole("link", { name: "Modules", exact: true }).click();
      await page.getByRole("link", { name: data.modules[P].name, exact: true }).click();
      await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 60_000 });
    });
    await shot(page, "06-module-detail");

    await s("save a filtered view and find it under Views", async () => {
      await page.goto(projectUrl(P));
      await expect(count(page, data.perProject)).toBeVisible({ timeout: 180_000 });
      await filter(page, "Priority", "Urgent");
      await page.getByRole("button", { name: "Save view" }).click();
      await page.getByRole("dialog").getByLabel("Name").fill(`Urgent ${stamp}`);
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /save|create/i })
        .click();
      await sidebar(page).getByRole("link", { name: "Views", exact: true }).click();
      await expect(page.getByText(`Urgent ${stamp}`)).toBeVisible();
    });
    await shot(page, "06-views");
    await s("projects page with 11 projects and 100,000 issues", async () => {
      await sidebar(page).getByRole("link", { name: "Projects", exact: true }).click();
      await expect(page.getByRole("list", { name: "Projects" })).toBeVisible({ timeout: 120_000 });
      return sample(w);
    });
    await shot(page, "06-projects");
    await s("duplicate project identifier is refused in the form", async () => {
      await sidebar(page).getByRole("button", { name: "New project" }).click();
      await page.getByLabel("Name").fill("Duplicate");
      await page.getByLabel("Identifier").fill("AUD0");
      await page.getByRole("button", { name: "Create project" }).click();
      await page.waitForTimeout(1200);
      const text = (
        await page
          .getByRole("dialog")
          .innerText()
          .catch(() => "DIALOG CLOSED")
      ).slice(0, 300);
      await shot(page, "06-duplicate-project");
      await page.keyboard.press("Escape");
      return { text, toasts: await toasts(page) };
    });
    for (const [name, path] of [
      ["labels", "settings/labels"],
      ["members", "settings/members"],
      ["project-settings", `projects/${data.projects[P].id}/settings`],
      ["archives", `projects/${data.projects[P].id}/archives`],
      ["not-found", "nothing/here"],
      ["unknown-issue", "issues/00000000-0000-0000-0000-000000000000"],
    ] as const) {
      await page.goto(`/${slug}/${path}`);
      await page.waitForTimeout(2500);
      await shot(page, `06-${name}`);
      note("measure", "flow", `page ${name}`, {
        text: (await page.locator("main, body").first().innerText()).slice(0, 160).replace(/\n/g, " | "),
      });
    }
    await s("workspace menu: switch theme to light", async () => {
      await page.goto(projectUrl(P));
      await sidebar(page).getByRole("button", { name: data.workspace.name, exact: true }).click();
      await shot(page, "06-workspace-menu");
      await page.getByRole("menuitem", { name: /theme/i }).click();
      await page.getByRole("menuitemradio", { name: /light/i }).click();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    });
    await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 120_000 });
    await shot(page, "06-light-list");
    await layout(page, "Board");
    await shot(page, "06-light-board");
  } finally {
    note(w.errors.length || w.failed.length ? "finding" : "ok", "flow", "page errors (member's day)", {
      errors: w.errors,
      failed: w.failed,
      console: w.consoleErrors.slice(0, 10),
    });
    await page.context().close();
  }
});

async function tour(page: Page, name: string) {
  await page.goto(projectUrl(P));
  await expect(page.getByTestId("issue-row").first()).toBeVisible({ timeout: 180_000 });
  await shot(page, `06-${name}-list`);
  const overflow: Record<string, number> = {};
  overflow.list = await overflowPx(page);
  for (const view of ["Board", "Spreadsheet", "Calendar", "Timeline"] as const) {
    await layout(page, view);
    await page.waitForTimeout(700);
    await shot(page, `06-${name}-${view}`);
    overflow[view] = await overflowPx(page);
  }
  await layout(page, "List");
  await page.getByTestId("issue-row").first().getByRole("link").first().click();
  await page.waitForTimeout(800);
  await shot(page, `06-${name}-peek`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("c");
  await page.waitForTimeout(500);
  await shot(page, `06-${name}-new-issue`);
  await page.keyboard.press("Escape");
  return overflow;
}

test("phone and tablet widths", async ({ browser }) => {
  for (const [name, viewport] of [
    ["phone", { width: 390, height: 844 }],
    ["tablet", { width: 820, height: 1180 }],
  ] as const) {
    const context = await contextOf(browser, "bob");
    const w = await watch(context);
    await w.page.setViewportSize(viewport);
    try {
      const overflow = await tour(w.page, name);
      const small = await w.page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("button, a, [role=button], input, [role=radio]")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24))
            out.push(
              `${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`,
            );
        }
        return out;
      });
      note(
        Object.values(overflow).some((v) => v > 0) ? "finding" : "ok",
        "responsive",
        `${name}: horizontal page overflow`,
        overflow,
      );
      note("measure", "responsive", `${name}: controls smaller than 24px`, {
        count: small.length,
        sample: small.slice(0, 15),
      });
      if (name === "phone") {
        await w.page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
        await w.page.waitForTimeout(500);
        await shot(w.page, "06-phone-sidebar");
      }
    } catch (error) {
      await shot(w.page, `fail-responsive-${name}`);
      note("finding", "responsive", `FAILED: ${name} tour`, String(error).slice(0, 500));
    } finally {
      note(w.errors.length ? "finding" : "ok", "responsive", `page errors (${name})`, w.errors);
      await context.close();
    }
  }
});

test("accessibility basics on the main pages", async ({ browser }) => {
  const w = await watch(await contextOf(browser, "bob"));
  const { page } = w;
  try {
    for (const [name, url] of [
      ["list", projectUrl(P)],
      ["issue", `/${slug}/issues/${data.ids[P * data.perProject + 5]}`],
      ["members", `/${slug}/settings/members`],
      ["login", "/login"],
    ] as const) {
      if (name === "login") await page.context().clearCookies();
      await page.goto(url);
      await page.waitForTimeout(name === "list" ? 6000 : 3000);
      const report = await page.evaluate(() => {
        const nameOf = (el: Element) =>
          (el.getAttribute("aria-label") ?? "") +
          (el.getAttribute("aria-labelledby") ?? "") +
          (el.getAttribute("title") ?? "") +
          (el.textContent ?? "").trim() +
          ((el as HTMLInputElement).labels?.[0]?.textContent ?? "") +
          (el.getAttribute("placeholder") ?? "");
        const unnamed = [
          ...document.querySelectorAll(
            "button, a[href], input, textarea, select, [role=button], [role=checkbox], [role=combobox]",
          ),
        ]
          .filter((el) => (el as HTMLElement).offsetParent !== null && !nameOf(el))
          .map((el) => el.outerHTML.slice(0, 140));
        const headings = [...document.querySelectorAll("h1,h2,h3")].map(
          (h) => `${h.tagName}:${h.textContent?.slice(0, 30)}`,
        );
        return {
          lang: document.documentElement.lang,
          title: document.title,
          unnamed: unnamed.slice(0, 8),
          unnamedCount: unnamed.length,
          h1: document.querySelectorAll("h1").length,
          headings: headings.slice(0, 8),
          landmarks: { main: document.querySelectorAll("main").length, nav: document.querySelectorAll("nav").length },
          imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
        };
      });
      const focus: string[] = [];
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Tab");
        focus.push(
          await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            const ring = el
              ? getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none"
              : false;
            return `${el?.tagName.toLowerCase()}[${el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 18)}]${ring ? "" : " NO-RING"}`;
          }),
        );
      }
      note(report.unnamedCount || !report.title || report.imagesWithoutAlt ? "finding" : "ok", "a11y", `${name} page`, {
        ...report,
        focus,
      });
    }
  } finally {
    await page.context().close();
  }
});

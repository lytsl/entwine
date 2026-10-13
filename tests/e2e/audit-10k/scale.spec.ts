import { writeFile } from "node:fs/promises";
import { cpus, platform, totalmem } from "node:os";
import { type Row, sortIssues } from "@entwine/shared";
import type { Page, TestInfo } from "@playwright/test";
import { choose, display, filter, groupBy, heading, layout, row, search, sidebar } from "../helpers/page";
import { expect, test } from "../helpers/test";
import { allIssues, openMember, ready } from "./helpers";
import { type Dataset, seed, titleOf } from "./seed";

let data: Dataset;
test.beforeAll(async ({ request }) => {
  data = await seed(request);
});
const layouts = ["List", "Board", "Spreadsheet", "Calendar", "Timeline"] as const;
const selector = (name: (typeof layouts)[number]) =>
  ({
    List: '[data-testid="issue-row"]',
    Board: '[data-testid="issue-card"]',
    Spreadsheet: "tbody tr[data-issue-id]",
    Calendar: '[data-testid="calendar-issue"]',
    Timeline: '[data-testid="timeline-row"]',
  })[name];
const paint = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
// Batched API creates share timestamps: the spec leaves ties unordered, so compare sort fields, not UUIDs.
const sortRank = (issue: Row<"Issue">, order: "priority" | "created" | "updated" | "due") =>
  order === "due"
    ? [issue.dueDate, issue.priority, issue.createdAt]
    : order === "priority"
      ? [issue.priority, issue.createdAt]
      : order === "updated"
        ? [issue.updatedAt, issue.createdAt]
        : [issue.createdAt];
async function attach(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(name);
  await writeFile(path, JSON.stringify(value, null, 2));
  await testInfo.attach(name, { path, contentType: "application/json" });
}

for (const name of ["Calendar", "Timeline"] as const) {
  test(`${name} bounds mounted issues at 10,000 and exposes offscreen rows by scrolling`, async ({
    browser,
  }, testInfo) => {
    const page = await openMember(browser, data, "ada");
    try {
      await page.goto(allIssues(data));
      await ready(page);
      const started = performance.now();
      await layout(page, name);
      await expect(page.locator(selector(name)).first()).toBeVisible();
      const rendered = await page.locator(selector(name)).count();
      await attach(testInfo, "virtualization.json", { name, rendered, elapsedMs: performance.now() - started });
      expect(rendered).toBeLessThan(name === "Calendar" ? 1000 : 100);
      const firstTitle = await page.locator(selector(name)).first().getByRole("link").textContent();
      const scroller =
        name === "Timeline"
          ? page.getByRole("list", { name: "Timeline" }).locator("../..")
          : page
              .getByRole("region")
              .filter({ has: page.getByTestId("calendar-issue") })
              .first()
              .locator("[data-calendar-scroll]");
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect
        .poll(async () => page.locator(selector(name)).first().getByRole("link").textContent())
        .not.toBe(firstTitle);
      expect(await page.locator(selector(name)).count()).toBeLessThan(name === "Calendar" ? 1000 : 100);
    } finally {
      await page.context().close();
    }
  });
}

test("all five layouts, cold/warm loads, interactions and repeated navigation measurements", async ({
  browser,
}, testInfo) => {
  const samples: unknown[] = [];
  for (let repetition = 0; repetition < 3; repetition++) {
    const page = await openMember(browser, data, "ada");
    try {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        const tasks: { startTime: number; duration: number }[] = [];
        Object.assign(window, { auditLongTasks: tasks });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) tasks.push({ startTime: e.startTime, duration: e.duration });
        }).observe({ type: "longtask", buffered: true });
      });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Performance.enable");
      const snapshot = async (phase: string, elapsedMs: number) => {
        await paint(page);
        const dom = await cdp.send("Memory.getDOMCounters");
        const elements = await page.locator("*").count();
        const metrics = (await cdp.send("Performance.getMetrics")).metrics.filter(({ name }) =>
          [
            "TaskDuration",
            "ScriptDuration",
            "LayoutDuration",
            "RecalcStyleDuration",
            "JSHeapUsedSize",
            "JSHeapTotalSize",
          ].includes(name),
        );
        const mountedIssues = await page.evaluate(() => ({
          list: document.querySelectorAll('[data-testid="issue-row"]').length,
          board: document.querySelectorAll('[data-testid="issue-card"]').length,
          spreadsheet: document.querySelectorAll("tbody tr[data-issue-id]").length,
          calendar: document.querySelectorAll('[data-testid="calendar-issue"]').length,
          timeline: document.querySelectorAll('[data-testid="timeline-row"]').length,
        }));
        await cdp.send("HeapProfiler.collectGarbage");
        const heap = await cdp.send("Runtime.getHeapUsage");
        const longTasks = await page.evaluate(() =>
          (window as unknown as { auditLongTasks: { startTime: number; duration: number }[] }).auditLongTasks.splice(0),
        );
        samples.push({ repetition, phase, elapsedMs, elements, mountedIssues, dom, heap, metrics, longTasks });
      };
      let start = performance.now();
      await page.goto(allIssues(data));
      await ready(page);
      await snapshot("cold all issues", performance.now() - start);
      // Sending waits for earlier device writes. A real edit and undo form a durable-load barrier.
      await search(page, titleOf(9999));
      await expect(page.getByTitle("1 issue", { exact: true })).toBeVisible();
      const storedEdit = page.waitForResponse((response) => response.url().endsWith("/transactions"));
      await choose(page, row(page, titleOf(9999)).getByLabel("Priority: No priority"), "High");
      expect((await storedEdit).ok()).toBe(true);
      const storedUndo = page.waitForResponse(
        (response) => response.url().endsWith("/transactions") && !!response.request().postDataJSON().revert,
      );
      await page.keyboard.press("ControlOrMeta+z");
      expect((await storedUndo).ok()).toBe(true);
      await expect(row(page, titleOf(9999)).getByLabel("Priority: No priority")).toBeVisible();
      await page.getByLabel("Search issues").press("Escape");
      await ready(page);
      await paint(page);
      await page.evaluate(() => (window as unknown as { auditLongTasks: unknown[] }).auditLongTasks.splice(0));
      start = performance.now();
      const loads: string[] = [];
      page.on("request", (r) => {
        if (r.url().endsWith("/load")) loads.push(r.postData() ?? "");
      });
      await page.reload();
      await ready(page);
      await snapshot("warm reload", performance.now() - start);
      samples.push({ repetition, phase: "warm load requests", loads: [...loads] });
      expect(loads).toEqual([]);
      for (let round = 0; round < 3; round++) {
        // Navigation opens List; start elsewhere so every timed selection actually changes layouts.
        await layout(page, "Timeline");
        await expect(page.locator(selector("Timeline")).first()).toBeVisible();
        await paint(page);
        await page.evaluate(() => (window as unknown as { auditLongTasks: unknown[] }).auditLongTasks.splice(0));
        for (const name of layouts) {
          start = performance.now();
          await layout(page, name);
          await expect(page.locator(selector(name)).first()).toBeVisible();
          await snapshot(`${round} ${name}`, performance.now() - start);
          expect(await page.locator(selector(name)).count()).toBeLessThan(
            name === "Calendar" ? 1000 : name === "Board" ? 300 : 100,
          );
          start = performance.now();
          await search(page, titleOf(9999));
          await expect(page.getByTitle("1 issue", { exact: true })).toBeVisible();
          // Issue 9999 is dated but may lie outside the month shown.
          if (name !== "Calendar")
            await expect(page.getByRole("link", { name: titleOf(9999), exact: true })).toBeVisible();
          await snapshot(`${round} ${name} search`, performance.now() - start);
          await page.getByLabel("Search issues").press("Escape");
          await ready(page);
        }
        start = performance.now();
        await sidebar(page).getByRole("link", { name: data.projects[round].name, exact: true }).click();
        await expect(page.getByTitle("2000 issues", { exact: true })).toBeVisible();
        await snapshot(`${round} project navigation`, performance.now() - start);
        start = performance.now();
        await sidebar(page).getByRole("link", { name: "All issues", exact: true }).click();
        await ready(page);
        await snapshot(`${round} workspace navigation`, performance.now() - start);
      }
      expect(errors).toEqual([]);
    } finally {
      await page.context().close();
    }
  }
  await attach(testInfo, "measurements.json", {
    mode: process.env.AUDIT_MODE ?? "development",
    chromium: browser.version(),
    node: process.version,
    platform: platform(),
    cpus: cpus().length,
    cpu: cpus()[0].model,
    hostMemory: totalmem(),
    viewport: { width: 1440, height: 900 },
    timezone: "Asia/Kolkata",
    seedDate: data.today,
    issueCount: 10000,
    seedMs: data.seedMs,
    samples,
  });
});

test("search, filters, sort, scrolling, keyboard selection and bulk undo across 10,000 issues", async ({ browser }) => {
  const page = await openMember(browser, data, "ada");
  try {
    await page.goto(allIssues(data));
    await ready(page);
    await groupBy(page, "No grouping");
    const loads: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/load")) loads.push(r.url());
    });
    for (const name of layouts) {
      await layout(page, name);
      await filter(page, "Priority", "Urgent");
      await expect(page.getByTitle("2000 issues", { exact: true })).toBeVisible();
      await filter(page, "Priority", "High");
      await expect(page.getByTitle("4000 issues", { exact: true })).toBeVisible();
      await filter(page, "Assignee", "Unassigned");
      await expect(page.getByTitle("1000 issues", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Clear all", exact: true }).click();
      await ready(page);
      await search(page, "AUD4-1999");
      await expect(page.getByTitle("1 issue", { exact: true })).toBeVisible();
      await page.getByLabel("Search issues").press("Escape");
      await ready(page);
    }
    expect(loads).toEqual([]);
    await layout(page, "List");
    await display(page, async (panel) => {
      await panel.getByRole("button", { name: "Ordering" }).click();
      await page.getByRole("menuitemradio", { name: "Due date", exact: true }).click();
    });
    const loaded = await (
      await page.request.post(`${data.endpoint}/load`, { data: { queries: [{ model: "Issue" }] } })
    ).json();
    const expected = sortIssues(loaded.rows.Issue, "due");
    const issueById = new Map<string, Row<"Issue">>(loaded.rows.Issue.map((issue: Row<"Issue">) => [issue.id, issue]));
    expect(
      sortRank(issueById.get((await page.getByTestId("issue-row").first().getAttribute("data-issue-id"))!)!, "due"),
    ).toEqual(sortRank(expected[0], "due"));
    const scroller = page.getByTestId("issue-row").first().locator("../../..");
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect
      .poll(async () =>
        sortRank(issueById.get((await page.getByTestId("issue-row").last().getAttribute("data-issue-id"))!)!, "due"),
      )
      .toEqual(sortRank(expected.at(-1)!, "due"));
    expect(await page.getByTestId("issue-row").count()).toBeLessThan(100);
    // Enter on a focused toolbar button belongs to that control; keyboard navigation starts in the view.
    await heading(page).click();
    await page.keyboard.press("j");
    const focused = page.locator("[data-issue-id][data-focused]");
    await expect(focused).toBeInViewport();
    const visited = [(await focused.getAttribute("data-issue-id"))!];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("j");
      await expect(focused).toBeInViewport();
      visited.push((await focused.getAttribute("data-issue-id"))!);
    }
    expect(new Set(visited).size).toBe(61);
    await page.keyboard.press("k");
    await expect(focused).toHaveAttribute("data-issue-id", visited[59]);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: "Issue preview" }).getByLabel("Title")).toHaveValue(
      issueById.get(visited[59])!.title,
    );
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+a");
    await expect(page.getByRole("toolbar", { name: "Selected issues" })).toContainText("10000 selected");
    await page.keyboard.press("Escape");
    await search(page, "Audit issue 0000");
    await expect(page.getByTitle("9 issues", { exact: true })).toBeVisible();
    await page.getByLabel("Search issues").press("Tab");
    const boxes = page.getByRole("checkbox", { name: /^Select / });
    await boxes.first().click();
    await boxes.nth(3).click({ modifiers: ["Shift"] });
    const bar = page.getByRole("toolbar", { name: "Selected issues" });
    await expect(bar).toContainText("4 selected");
    const selectedIds = await page
      .getByTestId("issue-row")
      .filter({ has: page.getByRole("checkbox", { checked: true }) })
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-issue-id")));
    await bar.getByRole("button", { name: "Priority", exact: true }).click();
    const saved = page.waitForResponse((r) => r.url().endsWith("/transactions"));
    await page.getByRole("menuitemradio", { name: "Low", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    for (const id of selectedIds)
      await expect(page.locator(`[data-issue-id="${id}"]`).getByLabel("Priority: Low")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("ControlOrMeta+z");
    for (const id of selectedIds) {
      const before = loaded.rows.Issue.find((i: { id: string }) => i.id === id);
      await expect(
        page
          .locator(`[data-issue-id="${id}"]`)
          .getByLabel(`Priority: ${before.priority === "urgent" ? "Urgent" : "High"}`),
      ).toBeVisible();
    }
  } finally {
    await page.context().close();
  }
});

test("isolated users sync offline edits, reconnect, durable reload, undo/redo and closed-tab takeover at scale", async ({
  browser,
}, testInfo) => {
  const ada = await openMember(browser, data, "ada");
  const bob = await openMember(browser, data, "bob");
  const samples: unknown[] = [];
  const target = titleOf(9999);
  try {
    for (const page of [ada, bob]) {
      await page.goto(allIssues(data));
      await ready(page);
      await search(page, target);
      await expect(page.getByTitle("1 issue", { exact: true })).toBeVisible();
      await page.getByLabel("Search issues").press("Tab");
    }
    expect(ada.context()).not.toBe(bob.context());
    for (const priority of ["High", "Low", "High"] as const) {
      const start = performance.now();
      await choose(ada, row(ada, target).getByLabel(/^Priority:/), priority);
      await expect(row(ada, target).getByLabel(`Priority: ${priority}`)).toBeVisible();
      const optimisticMs = performance.now() - start;
      await expect(row(bob, target).getByLabel(`Priority: ${priority}`)).toBeVisible();
      samples.push({ priority, optimisticMs, remoteMs: performance.now() - start });
    }
    await ada.keyboard.press("ControlOrMeta+z");
    await expect(row(bob, target).getByLabel("Priority: Low")).toBeVisible();
    await ada.keyboard.press("ControlOrMeta+Shift+z");
    await expect(row(bob, target).getByLabel("Priority: High")).toBeVisible();
    // API faults leave app assets reachable, permitting a real document reload while sync is unavailable.
    await ada.context().route("**/api/w/**", (route) => route.abort("internetdisconnected"));
    await ada.context().setOffline(true);
    await expect(ada.getByTestId("sync-status")).toHaveText("Offline");
    await ada.context().setOffline(false);
    await choose(ada, row(ada, target).getByLabel("Priority: High"), "Urgent");
    await expect(ada.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");
    await expect(row(bob, target).getByLabel("Priority: High")).toBeVisible();
    const requests: string[] = [];
    ada.on("request", (r) => {
      if (r.url().endsWith("/load")) requests.push(r.postData() ?? "");
    });
    await ada.reload();
    await expect(row(ada, target).getByLabel("Priority: Urgent")).toBeVisible();
    await expect(ada.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");
    expect(requests).toEqual([]);
    await ada.context().unroute("**/api/w/**");
    await expect(row(bob, target).getByLabel("Priority: Urgent")).toBeVisible();
    await expect(ada.getByTestId("sync-status")).toHaveText("Live");
    await ada.keyboard.press("ControlOrMeta+z");
    await expect(row(bob, target).getByLabel("Priority: High")).toBeVisible();
    const second = await ada.context().newPage();
    const secondLoads: string[] = [];
    second.on("request", (r) => {
      if (r.url().endsWith("/load")) secondLoads.push(r.url());
    });
    await second.goto(ada.url());
    await expect(row(second, target).getByLabel("Priority: High")).toBeVisible();
    expect(secondLoads).toEqual([]);
    await ada.context().setOffline(true);
    await choose(second, row(second, target).getByLabel("Priority: High"), "Medium");
    await expect(second.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");
    await second.close();
    const transactionIds: string[] = [];
    ada.on("request", (r) => {
      if (r.url().endsWith("/transactions")) transactionIds.push(r.postDataJSON().id);
    });
    await ada.context().setOffline(false);
    await expect(row(ada, target).getByLabel("Priority: Medium")).toBeVisible();
    await expect(row(bob, target).getByLabel("Priority: Medium")).toBeVisible();
    await expect(ada.getByTestId("sync-status")).toHaveText("Live");
    expect(new Set(transactionIds).size).toBe(1);
    await ada.reload();
    await expect(row(ada, target).getByLabel("Priority: Medium")).toBeVisible();
    const takeoverTransactionIds = [...transactionIds];
    const successor = await ada.context().newPage();
    await successor.goto(ada.url());
    await expect(row(successor, target).getByLabel("Priority: Medium")).toBeVisible();
    await ada.context().setOffline(true);
    await choose(ada, row(ada, target).getByLabel("Priority: Medium"), "Low");
    await expect(ada.getByTestId("sync-status")).toHaveText("Offline · 1 change waiting");
    await ada.close();
    const leaderTransactionIds: string[] = [];
    successor.on("request", (request) => {
      if (request.url().endsWith("/transactions")) leaderTransactionIds.push(request.postDataJSON().id);
    });
    await successor.context().setOffline(false);
    await expect(row(successor, target).getByLabel("Priority: Low")).toBeVisible();
    await expect(row(bob, target).getByLabel("Priority: Low")).toBeVisible();
    await expect(successor.getByTestId("sync-status")).toHaveText("Live");
    expect(new Set(leaderTransactionIds).size).toBe(1);
    const leaderTakeoverTransactionIds = [...leaderTransactionIds];
    await choose(successor, row(successor, target).getByLabel("Priority: Low"), "No priority");
    await expect(row(bob, target).getByLabel("Priority: No priority")).toBeVisible();
    await attach(testInfo, "sync-measurements.json", {
      mode: process.env.AUDIT_MODE ?? "development",
      samples,
      transactionIds: takeoverTransactionIds,
      leaderTakeoverTransactionIds,
    });
  } finally {
    await Promise.all([ada.context().close(), bob.context().close()]);
  }
});

test("every filter field and ordering mode works over the complete dataset", async ({ browser }) => {
  const page = await openMember(browser, data, "ada");
  try {
    await page.goto(allIssues(data));
    await ready(page);
    await groupBy(page, "No grouping");
    const cases: [string, string, number][] = [
      ["State", "Backlog", 2000],
      ["Assignee", "Bob", 2500],
      ["Label", "Audit label 1", 2500],
      ["Project", "Audit project 0", 2000],
      ["Created by", "Ada", 10000],
      ["Cycle", "AUD0 · Audit cycle 0", 1333],
      ["Module", "AUD0 · Audit module 0", 1333],
      ["Cycle", "No cycle", 3334],
      ["Module", "No module", 3334],
      ["Due date", "No due date", 1429],
      [
        "Due date",
        "Overdue",
        Array.from({ length: 10000 }, (_, i) => i).filter((i) => i % 7 !== 0 && i % 61 < 30 && i % 5 < 3).length,
      ],
      [
        "Due date",
        "Due this week",
        Array.from({ length: 10000 }, (_, i) => i).filter((i) => i % 7 !== 0 && i % 61 >= 30 && i % 61 <= 36).length,
      ],
    ];
    for (const [section, value, count] of cases) {
      await filter(page, section, value);
      await expect(page.getByTitle(`${count} issues`, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Clear all", exact: true }).click();
      await ready(page);
    }
    const loaded = await (
      await page.request.post(`${data.endpoint}/load`, { data: { queries: [{ model: "Issue" }] } })
    ).json();
    for (const [value, order] of [
      ["Priority", "priority"],
      ["Newest", "created"],
      ["Last updated", "updated"],
      ["Due date", "due"],
    ] as const) {
      await display(page, async (panel) => {
        await panel.getByRole("button", { name: "Ordering" }).click();
        await page.getByRole("menuitemradio", { name: value, exact: true }).click();
      });
      const expected = sortIssues(loaded.rows.Issue, order);
      const id = (await page.getByTestId("issue-row").first().getAttribute("data-issue-id"))!;
      expect(
        sortRank(
          loaded.rows.Issue.find((issue: Row<"Issue">) => issue.id === id),
          order,
        ),
      ).toEqual(sortRank(expected[0], order));
    }
  } finally {
    await page.context().close();
  }
});

for (const name of ["Board", "Spreadsheet"] as const) {
  test(`${name} scrolls, moves keyboard focus beyond the viewport, and bulk edits a selected range`, async ({
    browser,
  }) => {
    const page = await openMember(browser, data, "ada");
    try {
      await page.goto(allIssues(data));
      await ready(page);
      await layout(page, name);
      const rendered = page.locator(selector(name));
      const first = await rendered.first().getAttribute("data-issue-id");
      await rendered.first().evaluate((el) => {
        let parent = el.parentElement;
        while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
        if (!parent) throw new Error("Missing scroll container");
        parent.scrollTop = parent.scrollHeight;
      });
      await expect.poll(() => rendered.first().getAttribute("data-issue-id")).not.toBe(first);
      expect(await rendered.count()).toBeLessThan(name === "Board" ? 300 : 100);
      await page.keyboard.press("j");
      await expect(page.locator("[data-issue-id][data-focused]")).toHaveCount(1);
      const focusedBefore = await page.locator("[data-issue-id][data-focused]").getAttribute("data-issue-id");
      for (let i = 0; i < 60; i++) await page.keyboard.press("j");
      const focused = page.locator("[data-issue-id][data-focused]");
      await expect(focused).toBeInViewport();
      expect(await focused.getAttribute("data-issue-id")).not.toBe(focusedBefore);
      await page.keyboard.press("x");
      await expect(page.getByRole("toolbar", { name: "Selected issues" })).toContainText("1 selected");
      await page.keyboard.press("Escape");
      await search(page, "Audit issue 0000");
      await expect(page.getByTitle("9 issues", { exact: true })).toBeVisible();
      await page.getByLabel("Search issues").press("Tab");
      const boxes = page.getByRole("checkbox", { name: /^Select / });
      await boxes.first().click();
      await boxes.nth(3).click({ modifiers: ["Shift"] });
      const bar = page.getByRole("toolbar", { name: "Selected issues" });
      await expect(bar).toContainText("4 selected");
      const ids = await rendered
        .filter({ has: page.getByRole("checkbox", { checked: true }) })
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-issue-id")));
      const saved = page.waitForResponse((r) => r.url().endsWith("/transactions"));
      await bar.getByRole("button", { name: "Priority", exact: true }).click();
      await page.getByRole("menuitemradio", { name: "Low", exact: true }).click();
      expect((await saved).ok()).toBe(true);
      for (const id of ids)
        await expect(page.locator(`[data-issue-id="${id}"]`).getByLabel("Priority: Low")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.keyboard.press("ControlOrMeta+z");
      await expect(rendered.getByLabel("Priority: Low")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });
}

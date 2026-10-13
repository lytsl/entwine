import type { Locator, Page } from "@playwright/test";
import {
  choose,
  createIssue,
  heading,
  isoDay,
  newPlan,
  newProject,
  openPage,
  openProject,
  peek,
  progress,
  row,
} from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

/** The members' list: the lead's, which offers the same people, may still be closing. */
const members = (page: Page): Locator =>
  page.getByRole("dialog").filter({ has: page.getByPlaceholder("Add or remove members…") });
const daysFromToday = (days: number) => isoDay(new Date(Date.now() + days * 86_400_000));

test("a schedule saved in settings creates cycles for every member and rolls unfinished issues over", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Yearly");
  const sent = ada.waitForResponse((response) => response.url().endsWith("/transactions"));
  await createIssue(ada, "Left unfinished");
  const api = (await sent).url().replace(/\/transactions$/, "");
  await expect(row(ada, "Left unfinished")).toBeVisible();

  // A cycle that ended days ago, which the dialog's calendar does not reach quickly: made as the app makes one.
  const loaded = await ada.request.post(`${api}/load`, { data: { queries: [{ model: "Project" }] } });
  const { id: projectId } = (await loaded.json()).rows.Project.find(
    (p: { identifier: string }) => p.identifier === project.identifier,
  );
  const issues = await ada.request.post(`${api}/load`, {
    data: { queries: [{ model: "Issue", where: { projectId } }] },
  });
  const [issue] = (await issues.json()).rows.Issue;
  const cycleId = crypto.randomUUID();
  const ended = await ada.request.post(`${api}/transactions`, {
    data: {
      id: crypto.randomUUID(),
      mutations: [
        {
          model: "Cycle",
          type: "insert",
          key: cycleId,
          value: {
            id: cycleId,
            projectId,
            name: "Old sprint",
            startDate: daysFromToday(-10),
            endDate: daysFromToday(-3),
          },
        },
        { model: "Issue", type: "update", key: issue.id, value: { cycleId } },
      ],
    },
  });
  expect(ended.ok()).toBe(true);

  await openProject(bob, project.name);
  await openPage(bob, "Cycles");
  await expect(bob.getByRole("region", { name: "Past" })).toBeVisible();
  await expect(bob.getByRole("region", { name: "Upcoming" })).toHaveCount(0);

  await openPage(ada, "Settings");
  const schedule = ada.getByRole("region", { name: "Cycles", exact: true });
  const save = schedule.getByRole("button", { name: "Save schedule" });
  await expect(save).toBeDisabled();
  await expect(schedule.getByLabel(/^Cycle length:/)).toBeDisabled();
  await schedule.getByRole("switch", { name: "Create cycles automatically" }).click();
  await choose(ada, schedule.getByLabel("Cycle length: 2 weeks"), "1 week");
  await choose(ada, schedule.getByLabel("Upcoming cycles: 2 cycles"), "3 cycles");
  await schedule.getByRole("switch", { name: "Roll over unfinished issues" }).click();
  await save.click();
  await expect(ada.getByText("Cycle schedule saved")).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(schedule.getByLabel("Cycle length: 1 week")).toBeVisible();

  // Bob's open list follows: three cycles ahead, by the schedule and not by a member.
  const upcoming = bob.getByRole("region", { name: "Upcoming" });
  await expect(upcoming.getByRole("listitem")).toHaveCount(3);
  await expect(
    upcoming.getByRole("listitem").first().getByRole("img", { name: "Created by the schedule" }),
  ).toBeVisible();

  await openProject(ada, project.name);
  const panel = await peek(ada, "Left unfinished");
  await expect(panel.getByLabel("Cycle: Cycle 1")).toBeVisible();
  await expect(panel.getByTestId("activity").filter({ hasText: "entwine" })).toContainText(
    "entwine moved the issue from the cycle Old sprint to Cycle 1",
  );

  await ada.keyboard.press("Escape");
  await openPage(ada, "Settings");
  await schedule.getByRole("switch", { name: "Create cycles automatically" }).click();
  await save.click();
  await expect(ada.getByText("Cycle schedule turned off")).toBeVisible();
  await expect(upcoming.getByRole("listitem")).toHaveCount(3);
  await ada.screenshot({ path: test.info().outputPath("schedule.png"), fullPage: true });

  await ada.setViewportSize({ width: 320, height: 700 });
  for (const state of await ada.getByTestId("state-row").all()) {
    const box = (await state.getByRole("button", { name: / actions$/ }).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await ada.setViewportSize({ width: 1280, height: 720 });

  await openPage(ada, "Cycles");
  await ada.getByRole("region", { name: "Past" }).getByRole("button", { name: /^Past/ }).click();
  await ada.getByRole("link", { name: "Old sprint", exact: true }).click();
  await expect(progress(ada)).toContainText("0 of 1 done");
  await expect(progress(ada)).toContainText("1 unfinished issue moved to a later cycle");
});

test("progress counts estimate points beside issues, and follows states and estimates", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Zest");
  await openPage(ada, "Cycles");
  await newPlan(ada, "cycle", "Pointed");
  await ada.getByRole("link", { name: "Pointed", exact: true }).click();
  await expect(heading(ada)).toHaveText("Pointed");
  await createIssue(ada, "Big one");
  await createIssue(ada, "Small one");
  await createIssue(ada, "Unestimated");
  await expect(progress(ada)).toContainText("0 of 3 done");
  // Without an estimate in the cycle, issues are all it counts.
  await expect(progress(ada)).not.toContainText("point");

  let panel = await peek(ada, "Big one");
  await choose(ada, panel.getByLabel("Estimate: No estimate"), "5 points");
  await expect(progress(ada)).toContainText("0 of 5 points");
  await ada.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  panel = await peek(ada, "Small one");
  await choose(ada, panel.getByLabel("Estimate: No estimate"), "3 points");
  await expect(progress(ada)).toContainText("0 of 8 points");
  await ada.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);

  await choose(ada, row(ada, "Big one").getByLabel(/^State:/), "Done");
  await expect(progress(ada)).toContainText("1 of 3 done");
  await expect(progress(ada)).toContainText("5 of 8 points · 63% by estimate");
  await choose(ada, row(ada, "Small one").getByLabel(/^State:/), "Cancelled");
  await expect(progress(ada)).toContainText("1 of 2 done");
  await expect(progress(ada)).toContainText("5 of 5 points");

  await openPage(ada, "Cycles");
  const listed = ada.getByRole("listitem", { name: "Pointed" });
  await expect(listed.getByText("5 of 5 points", { exact: true })).toBeVisible();

  // A phone has no room for a column of counts: they go under the name, which keeps its own.
  await ada.setViewportSize({ width: 320, height: 640 });
  await expect(listed.getByText("1/2 done · 5 of 5 points")).toBeVisible();
  const name = listed.getByRole("link", { name: "Pointed", exact: true });
  await expect.poll(async () => (await name.boundingBox())?.width ?? 0).toBeGreaterThan(100);
});

test("a module's lead and members are set on its page and shown on its card to every member", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Xylo");
  await openPage(ada, "Modules");
  await newPlan(ada, "module", "Owned");
  await openProject(bob, project.name);
  await openPage(bob, "Modules");
  const card = bob.getByRole("listitem", { name: "Owned" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("img", { name: /Lead|Members/ })).toHaveCount(0);

  await ada.getByRole("link", { name: "Owned", exact: true }).click();
  await expect(heading(ada)).toHaveText("Owned");
  await choose(ada, ada.getByLabel("Lead: No lead"), "Bob");
  await expect(ada.getByLabel("Lead: Bob")).toBeVisible();
  await ada.getByLabel("Members", { exact: true }).click();
  await members(ada).getByRole("option", { name: "Cy", exact: true }).click();
  await members(ada).getByRole("option", { name: "Ada", exact: true }).click();
  await ada.keyboard.press("Escape");
  await expect(ada.getByLabel("Members: Ada, Cy")).toBeVisible();
  await expect(card.getByRole("img", { name: "Lead: Bob · Members: Ada, Cy" })).toBeVisible();

  const search = bob.getByLabel("Search modules");
  await search.fill("cy");
  await expect(card).toBeVisible();
  await search.fill("nobody");
  await expect(bob.getByText("No modules match “nobody”.")).toBeVisible();
  await search.fill("");

  await bob.getByRole("link", { name: "Owned", exact: true }).click();
  await bob.getByLabel("Members: Ada, Cy").click();
  await members(bob).getByRole("option", { name: "Cy", exact: true }).click();
  await bob.keyboard.press("Escape");
  await choose(bob, bob.getByLabel("Lead: Bob"), "No lead");
  await expect(ada.getByLabel("Members: Ada", { exact: true })).toBeVisible();
  await expect(ada.getByLabel("Lead: No lead")).toBeVisible();
  await ada.screenshot({ path: test.info().outputPath("module-people.png"), fullPage: true });
});

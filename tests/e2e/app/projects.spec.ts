import { createIssue, layout, newProject, openPage, openProject, sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("a custom state becomes a board column for every member, and can be deleted by moving its issues", async ({
  browser,
}) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Workflow");
  await createIssue(ada, "Needs review");

  await openPage(ada, "Settings");
  const started = ada.getByRole("group", { name: "Started", exact: true });
  await started.getByRole("button", { name: "Add a started state" }).click();
  await ada.getByLabel("New state name").fill("In Review");
  await ada.getByRole("button", { name: "Add state" }).click();
  await expect(started.getByTestId("state-row").filter({ hasText: "In Review" })).toBeVisible();
  await started.getByRole("button", { name: "In Review actions" }).click();
  await ada.getByRole("menuitem", { name: "Move up" }).click();
  await expect(started.getByTestId("state-row")).toHaveText([/In Review/, /In Progress/]);

  const bob = await signIn(browser, "bob");
  await openProject(bob, project.name);
  await layout(bob, "Board");
  // Board columns are regions with a heading; the toaster is a region too.
  const columns = bob.getByRole("region").filter({ has: bob.getByRole("heading", { level: 2 }) });
  await expect(columns).toHaveText([/Backlog/, /Todo/, /In Review/, /In Progress/, /Done/, /Cancelled/]);
  const card = bob.getByTestId("issue-card").filter({ hasText: "Needs review" });
  await card.dragTo(bob.getByRole("region", { name: "In Review" }));
  await expect(bob.getByRole("region", { name: "In Review" }).getByText("Needs review")).toBeVisible();

  await started.getByRole("button", { name: "In Review actions" }).click();
  await ada.getByRole("menuitem", { name: "Delete" }).click();
  await expect(ada.getByText("1 issue is in this state. Move them to:")).toBeVisible();
  await ada.getByRole("button", { name: "Delete state" }).click();
  await expect(bob.getByRole("region", { name: "In Review" })).toHaveCount(0);
  await expect(bob.getByRole("region", { name: "Backlog" }).getByText("Needs review")).toBeVisible();
});

test("a state dragged above another takes its place for every member", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Order");
  await openPage(ada, "Settings");
  const started = ada.getByRole("group", { name: "Started", exact: true });
  await started.getByRole("button", { name: "Add a started state" }).click();
  await ada.getByLabel("New state name").fill("In Review");
  await ada.getByRole("button", { name: "Add state" }).click();
  const rows = started.getByTestId("state-row");
  await expect(rows).toHaveText([/In Progress/, /In Review/]);
  await rows.filter({ hasText: "In Review" }).dragTo(rows.filter({ hasText: "In Progress" }), {
    targetPosition: { x: 40, y: 4 },
  });
  await expect(rows).toHaveText([/In Review/, /In Progress/]);

  const cy = await signIn(browser, "cy");
  await openProject(cy, project.name);
  await layout(cy, "Board");
  const columns = cy.getByRole("region").filter({ has: cy.getByRole("heading", { level: 2 }) });
  await expect(columns).toHaveText([/Backlog/, /Todo/, /In Review/, /In Progress/, /Done/, /Cancelled/]);
});

test("an archived project leaves the sidebar and comes back when restored", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const project = await newProject(ada, "Archive");
  await openPage(ada, "Settings");
  await ada.getByRole("button", { name: "Archive project" }).click();
  await expect(ada.getByRole("status")).toContainText(`${project.name} is archived`);

  const cy = await signIn(browser, "cy");
  await expect(sidebar(cy).getByRole("link", { name: project.name })).toHaveCount(0);
  await sidebar(cy).getByRole("link", { name: "Projects", exact: true }).click();
  const archived = cy.getByRole("list", { name: "Archived projects" });
  await archived.getByRole("listitem", { name: project.name }).getByRole("button", { name: "Restore" }).click();
  await expect(sidebar(cy).getByRole("link", { name: project.name })).toBeVisible();
  await expect(ada.getByRole("status")).toHaveCount(0);
});

test("only owners and admins can delete a project, after typing its identifier", async ({ browser }) => {
  const cy = await signIn(browser, "cy");
  const project = await newProject(cy, "Doomed");
  await openPage(cy, "Settings");
  await expect(cy.getByRole("button", { name: "Delete project" })).toBeDisabled();

  const ada = await signIn(browser, "ada");
  await openProject(ada, project.name);
  await openPage(ada, "Settings");
  await ada.getByRole("button", { name: "Delete project" }).click();
  const confirm = ada.getByRole("dialog").getByRole("button", { name: "Delete project" });
  await expect(confirm).toBeDisabled();
  await ada.getByLabel("Project identifier").fill(project.identifier.toLowerCase());
  await confirm.click();
  await expect(ada).toHaveURL(/\/projects$/);
  await expect(sidebar(cy).getByRole("link", { name: project.name })).toHaveCount(0);
});

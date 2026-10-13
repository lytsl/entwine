import { choose, createIssue, layout, newProject, openProject, peek, row } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("an issue created by one member appears live for another, who moves it on the board", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  const project = await newProject(ada, "Live");
  await openProject(bob, project.name);

  const title = `Live issue ${Date.now()}`;
  await createIssue(ada, title);
  await expect(ada.getByText(`${project.identifier}-1 created`)).toBeVisible();
  await expect(row(ada, title)).toBeVisible();

  await expect(bob.getByRole("link", { name: title })).toBeVisible();
  await layout(bob, "Board");
  const card = bob.getByTestId("issue-card").filter({ hasText: title });
  await card.dragTo(bob.getByRole("region", { name: "In Progress" }));
  await expect(bob.getByRole("region", { name: "In Progress" }).getByText(title)).toBeVisible();

  await expect(row(ada, title).getByLabel("State: In Progress")).toBeVisible();
  const panel = await peek(ada, title);
  await expect(
    panel.getByTestId("activity").filter({ hasText: "changed state from Backlog to In Progress" }),
  ).toBeVisible();
});

test("comments are live, and only their author can edit them", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  const cy = await signIn(browser, "cy");
  for (const page of [ada, cy]) {
    await openProject(page, "Website");
    await peek(page, "Redesign the landing page");
  }
  const body = `Looks good ${Date.now()}`;
  await ada.getByLabel("Comment", { exact: true }).fill(body);
  await ada.getByRole("button", { name: "Comment", exact: true }).click();
  const comment = cy.getByTestId("comment").filter({ hasText: body });
  await expect(comment).toBeVisible();
  await expect(comment.getByRole("button", { name: "Comment actions" })).toHaveCount(0);
});

test("filters live in the URL", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await openProject(ada, "Website");
  await ada.getByRole("button", { name: "Search", exact: true }).click();
  await ada.getByLabel("Search issues").fill("footer");
  await expect(ada.getByTestId("issue-row")).toHaveCount(1);
  await ada.reload();
  await expect(ada.getByLabel("Search issues")).toHaveValue("footer");
  await expect(ada.getByTestId("issue-row")).toHaveCount(1);
});

test("an issue opens beside the list, is edited there, and the panel is kept in the address", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Peek");
  const title = `Peeked ${Date.now()}`;
  await createIssue(ada, title);

  const panel = await peek(ada, title);
  await choose(ada, panel.getByLabel("Priority: No priority"), "High");
  await expect(row(ada, title).getByLabel("Priority: High")).toBeVisible();
  await expect(ada).toHaveURL(/peek=/);

  await ada.reload();
  await expect(ada.getByRole("complementary", { name: "Issue preview" }).getByLabel("Title")).toHaveValue(title);
  await ada.getByRole("button", { name: "Close preview" }).click();
  await expect(ada.getByRole("complementary", { name: "Issue preview" })).toHaveCount(0);
  await expect(ada).not.toHaveURL(/peek=/);
});

test("a board column takes new issues in place, in its state", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "Quick");
  await layout(ada, "Board");
  const column = ada.getByRole("region", { name: "In Progress" });
  await column.getByRole("button", { name: "New issue", exact: true }).click();
  const input = ada.getByLabel("Issue title in In Progress");
  await input.fill("Wire the webhook");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await input.fill("Retry failed deliveries");
  await input.press("Enter");
  await expect(column.getByTestId("issue-card")).toHaveText([/Retry failed deliveries/, /Wire the webhook/]);
});

test("Create more keeps the dialog open for the next issue", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await newProject(ada, "More");
  await ada.keyboard.press("c");
  await ada.getByRole("switch", { name: /Create more/ }).click();
  for (const title of ["First of many", "Second of many"]) {
    await ada.getByLabel("Title").fill(title);
    await ada.getByRole("button", { name: "Create issue" }).click();
    await expect(ada.getByLabel("Title")).toHaveValue("");
  }
  await ada.getByRole("button", { name: "Cancel" }).click();
  await expect(ada.getByTestId("issue-row")).toHaveText([/Second of many/, /First of many/]);
});

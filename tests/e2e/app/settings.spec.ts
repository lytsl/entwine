import { sidebar } from "../helpers/page";
import { expect, signIn, test } from "../helpers/test";

test("admins invite people and see pending invitations; members see the list only", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await sidebar(ada).getByRole("link", { name: "Members" }).click();
  await expect(ada.getByText("cy@example.com")).toBeVisible();
  const email = `guest-${Date.now()}@example.com`;
  await ada.getByRole("button", { name: "Invite people" }).click();
  await ada.getByLabel("Email to invite").fill(email);
  await ada.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(ada.getByRole("list", { name: "Pending invitations" }).getByText(email)).toBeVisible();

  const cy = await signIn(browser, "cy");
  await sidebar(cy).getByRole("link", { name: "Members" }).click();
  await expect(cy.getByText("ada@example.com")).toBeVisible();
  await expect(cy.getByRole("button", { name: "Invite people" })).toHaveCount(0);
});

test("labels are created once per name, ignoring case", async ({ browser }) => {
  const ada = await signIn(browser, "ada");
  await sidebar(ada).getByRole("link", { name: "Labels" }).click();
  const name = `Perf${Date.now()}`;
  await ada.getByRole("button", { name: "New label" }).click();
  await ada.getByLabel("New label").fill(name);
  await ada.getByRole("button", { name: "Create" }).click();
  await expect(ada.getByRole("list", { name: "Labels" }).getByRole("listitem", { name })).toBeVisible();
  await ada.getByLabel("New label").fill(name.toLowerCase());
  await ada.getByRole("button", { name: "Create" }).click();
  await expect(ada.getByText(`Label ${name.toLowerCase()} already exists`)).toBeVisible();
});

test("the members page follows other admins, keeps owners to owners and confirms a removal", async ({
  browser,
  baseURL,
}) => {
  const ada = await signIn(browser, "ada");
  const bob = await signIn(browser, "bob");
  for (const page of [ada, bob]) await sidebar(page).getByRole("link", { name: "Members" }).click();
  const headers = { Origin: baseURL as string };
  const [{ id: organizationId }] = await (await ada.request.get("/api/auth/organization/list")).json();

  // A newcomer whose name is as long as a name may be, in one unbroken word.
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `guest-${suffix}@example.com`;
  const name = `Guest${suffix}${"n".repeat(242)}`;
  const guest = await browser.newContext();
  const signedUp = await guest.request.post("/api/auth/sign-up/email", {
    headers,
    data: { name, email, password: "password123" },
  });
  expect(signedUp.ok()).toBe(true);
  const invitation = await (
    await ada.request.post("/api/auth/organization/invite-member", {
      headers,
      data: { email, role: "member", organizationId },
    })
  ).json();
  await guest.request.post("/api/auth/organization/accept-invitation", {
    headers,
    data: { invitationId: invitation.id },
  });

  // Both open pages list the newcomer without a reload, and the long name does not push the page sideways.
  const row = (page: typeof ada) => page.getByRole("row").filter({ hasText: email });
  await expect(row(ada)).toBeVisible();
  await expect(row(bob)).toBeVisible();
  expect(await ada.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );

  const owner = bob.getByRole("row").filter({ hasText: "ada@example.com" });
  await expect(owner.getByText("Owner", { exact: true })).toBeVisible();
  await expect(owner.getByRole("button")).toHaveCount(0);
  await row(bob)
    .getByRole("button", { name: /^Role of / })
    .click();
  await expect(bob.getByRole("option", { name: "Admin" })).toBeVisible();
  await expect(bob.getByRole("option", { name: "Owner" })).toHaveCount(0);
  await bob.getByRole("option", { name: "Admin" }).click();
  await expect(row(ada).getByRole("button", { name: /: admin$/ })).toBeVisible();

  const [project] = (
    await (
      await guest.request.post(`/api/w/${organizationId}/load`, {
        headers,
        data: { queries: [{ model: "Project", where: { identifier: "WEB" } }] },
      })
    ).json()
  ).rows.Project;
  const issueId = crypto.randomUUID();
  const created = await guest.request.post(`/api/w/${organizationId}/transactions`, {
    headers,
    data: {
      id: crypto.randomUUID(),
      mutations: [
        {
          model: "Issue",
          type: "insert",
          key: issueId,
          value: { id: issueId, projectId: project.id, title: `By ${suffix}`, stateId: `${project.id}:backlog` },
        },
        {
          model: "Comment",
          type: "insert",
          key: `${issueId}-c`,
          value: { id: `${issueId}-c`, issueId, body: "Hello" },
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  await row(ada)
    .getByRole("button", { name: /^Remove / })
    .click();
  const dialog = ada.getByRole("dialog");
  await expect(dialog).toContainText("They lose access to this workspace at once.");
  await expect(dialog.getByRole("button", { name: "Remove member" })).toBeInViewport({ ratio: 1 });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(row(ada)).toBeVisible();
  await row(ada)
    .getByRole("button", { name: /^Remove / })
    .click();
  await ada.getByRole("dialog").getByRole("button", { name: "Remove member" }).click();
  await expect(row(ada)).toHaveCount(0);
  await expect(row(bob)).toHaveCount(0);

  await bob.goto(`/acme/issues/${issueId}`);
  await expect(bob.getByTestId("comment")).toContainText("Hello");
  await expect(bob.getByRole("region", { name: "Properties" })).toContainText(`Guest${suffix}`);
  for (const region of ["Properties", "Activity"]) {
    const fits = await bob.getByRole("region", { name: region }).evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits, region).toBe(true);
  }
  await guest.close();
});

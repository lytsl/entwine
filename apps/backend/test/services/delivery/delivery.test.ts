import { afterEach, expect, test } from "bun:test";
import { defaultStates } from "@entwine/shared";
import type { Mutation } from "@entwine/sync-engine/protocol";
import { insert } from "../../helpers/requests";
import { type Account, testServer } from "../../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
afterEach(() => t.cleanup());

/** Short enough for a test, long enough for an undo or a read to come first. */
const DELAY_MS = 400;

const transact = (account: Account, workspaceId: string, body: { id: string } & Record<string, unknown>) =>
  account.json(`/api/w/${workspaceId}/transactions`, body);
const mutate = (account: Account, workspaceId: string, mutations: Mutation[], id: string = crypto.randomUUID()) =>
  transact(account, workspaceId, { id, mutations });
const update = (model: Mutation["model"], key: string, value: Record<string, unknown>): Mutation => ({
  model,
  type: "update",
  key,
  value,
});

async function verify(account: Account) {
  const link = await t.mailed((m) => m.to === account.email && m.subject === "Verify your email address");
  await account.fetch(new URL(link.url).pathname + new URL(link.url).search, { redirect: "manual" });
}

const mailsAbout = (key: string, to: string) => t.mail.filter((m) => m.to === to && m.subject.startsWith(`${key} `));
const mailAbout = (key: string, to: string) => t.mailed((m) => m.to === to && m.subject.startsWith(`${key} `));

/** Ada, Bob and Cy in "acme", with verified addresses; Ada created WEB-1 and WEB-2, so she follows both. */
async function acme() {
  const [ada, bob, cy] = [await t.signUp("ada"), await t.signUp("bob"), await t.signUp("cy")];
  for (const account of [ada, bob, cy]) await verify(account);
  const id = await t.workspace(ada, "acme", [
    [bob, "member"],
    [cy, "member"],
  ]);
  await mutate(ada, id, [
    insert("Project", { id: "p1", name: "Website", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
    insert("Issue", { id: "i1", projectId: "p1", title: "Fix login", stateId: "p1:unstarted" }),
    insert("Issue", { id: "i2", projectId: "p1", title: "Write docs", stateId: "p1:unstarted" }),
  ]);
  return { ada, bob, cy, id };
}

const comment = (issueId: string, body: string) => insert("Comment", { id: crypto.randomUUID(), issueId, body });

/** Once Ada is mailed of a later window, every earlier one has been sent: a workspace's windows go in order. */
async function settled(ada: Account, bob: Account, id: string) {
  const text = `Barrier ${crypto.randomUUID()}`;
  await mutate(bob, id, [comment("i2", text)]);
  await t.mailed((m) => m.to === ada.email && m.text.includes(text));
}

test("a member is mailed once per issue what is still unread, with each comment's text", async () => {
  t = await testServer({ mailDelayMs: DELAY_MS });
  const { bob, id } = await acme();
  await mutate(bob, id, [comment("i1", "It fails on **Safari**.")]);
  await mutate(bob, id, [comment("i1", "And on Firefox.")]);
  const mail = await mailAbout("WEB-1", "ada@example.com");
  expect(mail.subject).toBe("WEB-1 Fix login");
  expect(mail.text).toContain("2 UPDATES ON WEB-1");
  expect(mail.text).toContain("It fails on Safari.");
  expect(mail.text).toContain("And on Firefox.");
  expect(mail.url).toBe(`http://localhost:3000/acme/issues/i1`);
  expect(mailsAbout("WEB-1", "ada@example.com")).toHaveLength(1);
});

test("an undone notification, and one read in time, are not mailed", async () => {
  t = await testServer({ mailDelayMs: DELAY_MS });
  const { ada, bob, id } = await acme();
  await mutate(bob, id, [comment("i1", "Oops")], "oops");
  await transact(bob, id, { id: "undo", revert: "oops" });
  await mutate(bob, id, [comment("i2", "Read me")]);
  const { rows } = await ada.json<{ rows: { Notification: { id: string; issueId: string }[] } }>(`/api/w/${id}/load`, {
    queries: [{ model: "Notification" }],
  });
  const read = rows.Notification.find((n) => n.issueId === "i2")!;
  await mutate(ada, id, [update("Notification", read.id, { readAt: Date.now() })]);
  await settled(ada, bob, id);
  expect(mailsAbout("WEB-1", ada.email)).toHaveLength(0);
  expect(mailsAbout("WEB-2", ada.email).filter((m) => m.text.includes("Read me"))).toHaveLength(0);
});

test("only verified addresses are mailed, and only what their holder chose", async () => {
  t = await testServer({ mailDelayMs: DELAY_MS });
  const { ada, bob, cy, id } = await acme();
  const eve = await t.signUp("eve");
  await ada.json("/api/auth/organization/invite-member", { email: eve.email, role: "member", organizationId: id });
  const invitation = await t.mailed((m) => m.to === eve.email && m.url.includes("/invite/"));
  await eve.json("/api/auth/organization/accept-invitation", { invitationId: invitation.url.split("/").at(-1) });
  // Ada mutes state changes but keeps completions; Cy turns mail off.
  await ada.json("/api/auth/update-user", { mutedNotifications: ["state"] });
  await cy.json("/api/auth/update-user", { emailNotifications: false });
  for (const account of [cy, eve])
    await account.json(`/api/w/${id}/transactions`, {
      id: crypto.randomUUID(),
      mutations: [
        insert("IssueSubscription", { id: `i1:${account.id}`, issueId: "i1", memberId: account.id }),
        insert("IssueSubscription", { id: `i2:${account.id}`, issueId: "i2", memberId: account.id }),
      ],
    });

  await mutate(bob, id, [update("Issue", "i1", { stateId: "p1:started" })]);
  await mutate(bob, id, [update("Issue", "i2", { stateId: "p1:completed" })]);
  await mutate(bob, id, [comment("i1", "Started")]);
  const started = await mailAbout("WEB-1", ada.email);
  expect(started.text).toContain("Started");
  expect(started.text).not.toContain("Todo → In Progress");
  expect((await mailAbout("WEB-2", ada.email)).text).toContain("bob changed the state: Todo → Done");
  await settled(ada, bob, id);
  expect(t.mail.filter((m) => (m.to === cy.email || m.to === eve.email) && m.subject.startsWith("WEB-"))).toHaveLength(
    0,
  );
});

test("mail waiting when the server stops is sent after it starts again, once", async () => {
  t = await testServer({ mailDelayMs: DELAY_MS });
  const { ada, bob, id } = await acme();
  await mutate(bob, id, [comment("i1", "Before the restart")]);
  await t.restart();
  await mailAbout("WEB-1", ada.email);
  await settled(ada, bob, id);
  expect(mailsAbout("WEB-1", ada.email)).toHaveLength(1);
});

test("a notification is pushed at once to the browsers still signed in, unless its kind is off", async () => {
  t = await testServer();
  const { ada, bob, cy, id } = await acme();
  const subscribe = (account: Account, endpoint: string) =>
    account.json("/api/auth/push/subscribe", {
      endpoint: `https://fcm.googleapis.com/fcm/send/${endpoint}`,
      keys: { p256dh: "key", auth: "secret" },
    });
  await subscribe(ada, "ada");
  await subscribe(cy, "gone");
  await mutate(bob, id, [update("Issue", "i1", { assigneeId: ada.id })]);
  const pushed = await t.pushed((p) => p.endpoint.endsWith("/ada"));
  expect(pushed.message).toEqual({
    title: "bob assigned WEB-1 to you",
    body: "Fix login",
    url: "http://localhost:3000/acme/issues/i1",
    tag: "i1",
  });

  await ada.json("/api/auth/update-user", { mutedNotifications: ["commented"] });
  await mutate(cy, id, [insert("IssueSubscription", { id: `i1:${cy.id}`, issueId: "i1", memberId: cy.id })]);
  await mutate(bob, id, [comment("i1", "Ping")]);
  await t.pushed((p) => p.endpoint.endsWith("/gone"));

  await ada.fetch("/api/auth/sign-out", { method: "POST", body: "{}" });
  await subscribe(cy, "cy");
  await mutate(bob, id, [update("Issue", "i1", { stateId: "p1:started" })]);
  await t.pushed((p) => p.endpoint.endsWith("/cy"));
  // Ada was pushed nothing of the muted comment nor after signing out; the push service no longer knew Cy's old
  // browser, and signing out ended Ada's subscription.
  expect(t.pushes.filter((p) => p.endpoint.endsWith("/ada"))).toHaveLength(1);
  expect(t.server.auth.database.query('SELECT endpoint FROM "pushSubscription"').all()).toEqual([
    { endpoint: "https://fcm.googleapis.com/fcm/send/cy" },
  ]);
});

test("a push address on another host than a browser's push service is refused", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  for (const endpoint of [
    "http://fcm.googleapis.com/x",
    "https://169.254.169.254/x",
    "https://evilfcm.googleapis.com.example/x",
  ]) {
    const refused = await ada.fetch("/api/auth/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint, keys: { p256dh: "key", auth: "secret" } }),
    });
    expect(refused.status).toBe(400);
  }
});

test("more notifications than one load matches are still mailed", async () => {
  t = await testServer({ mailDelayMs: DELAY_MS });
  const { ada, bob, id } = await acme();
  const issues = Array.from({ length: 1100 }, (_, n) => `many${n}`);
  for (let from = 0; from < issues.length; from += 500)
    await mutate(
      ada,
      id,
      issues.slice(from, from + 500).map((issueId) =>
        insert("Issue", {
          id: issueId,
          projectId: "p1",
          title: issueId,
          stateId: "p1:unstarted",
          assigneeId: bob.id,
        }),
      ),
    );
  const mail = await t.mailed((m) => m.to === bob.email && m.subject.endsWith(" many1099"));
  expect(mail.text).toContain("many1099");
});

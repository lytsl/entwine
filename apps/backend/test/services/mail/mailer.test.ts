import { afterEach, expect, spyOn, test } from "bun:test";
import { smtpMailer } from "../../../src/services/mail/mailer";
import { testServer } from "../../helpers/server";
import { smtpSink } from "../../helpers/smtp-sink";

let t: Awaited<ReturnType<typeof testServer>> | undefined;
afterEach(async () => {
  await t?.cleanup();
  t = undefined;
});

const mail = { to: "cy@example.com", subject: "Hi", html: "<p>Hi &amp; welcome</p>", text: "Hi & welcome", url: "x" };

test("an invitation's mail names the inviter and the workspace", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  await ada.json("/api/auth/organization/invite-member", {
    email: "cy@example.com",
    role: "member",
    organizationId: id,
  });
  const invitation = await t.mailed((m) => m.to === "cy@example.com");
  expect(invitation.subject).toBe("ada invited you to join acme on entwine");
  expect(invitation.text).toContain("ada (ada@example.com) invited you to work with them in entwine.");
  expect(invitation.url).toMatch(/^http:\/\/localhost:3000\/invite\/[\w-]+$/);
});

test("an invitation does not wait for its mail", async () => {
  t = await testServer({ mailer: () => new Promise(() => {}) });
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  await ada.json("/api/auth/organization/invite-member", {
    email: "cy@example.com",
    role: "member",
    organizationId: id,
  });
});

test("the SMTP mailer sends the HTML and the plain text from the sender", async () => {
  const smtp = smtpSink();
  await smtpMailer(smtp.url, "entwine <noreply@example.com>")(mail);
  smtp.stop();
  const [{ source: message }] = smtp.messages;
  expect(message).toContain("From: entwine <noreply@example.com>");
  expect(message).toContain("To: cy@example.com");
  expect(message).toContain("Content-Type: text/plain");
  expect(message).toContain("Hi & welcome");
  expect(message).toContain("Content-Type: text/html");
  expect(message).toContain("<p>Hi &amp; welcome</p>");
});

test("the SMTP mailer logs a failed delivery instead of throwing", async () => {
  const smtp = smtpSink();
  smtp.stop();
  const error = spyOn(console, "error").mockImplementation(() => {});
  await smtpMailer(smtp.url, "noreply@example.com")(mail);
  expect(error.mock.calls[0]?.[0]).toStartWith('[mail] could not send "Hi" to cy@example.com:');
  error.mockRestore();
});

import { expect, test } from "bun:test";
import { plainText } from "../../../src/services/mail/plain-text";
import { changeEmailMail } from "../../../src/services/mail/templates/change-email";
import { notificationMail } from "../../../src/services/mail/templates/notification";
import { resetPasswordMail } from "../../../src/services/mail/templates/reset-password";

const BASE = "https://tracker.example.com";
const ada = { name: "Ada <script>", email: "ada@example.com" };
const firefox = new Request(BASE, {
  headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0" },
});

test("a security mail says which account, instance and browser asked, and escapes names", async () => {
  const mail = await resetPasswordMail(BASE, ada, `${BASE}/api/auth/reset-password/t`, firefox);
  expect(mail.subject).toBe("Reset your entwine password");
  expect(mail.html).toContain("Hi Ada &lt;script&gt;");
  expect(mail.html).not.toContain("<script>");
  for (const part of [mail.html, mail.text]) {
    expect(part).toContain(`${BASE}/api/auth/reset-password/t`);
    expect(part).toContain("tracker.example.com");
    expect(part).toContain("Firefox on Linux");
  }
  expect(mail.text).toContain("Sent to ada@example.com because someone asked to reset the password");
});

test("a change of address is confirmed by the old address, naming the new", async () => {
  const mail = await changeEmailMail(BASE, ada, "ada@new.example", `${BASE}/api/auth/verify-email?token=t`);
  expect(mail.to).toBe("ada@example.com");
  expect(mail.text).toContain("from ada@example.com to ada@new.example");
});

test("a notification mail shows the issue, each comment's text and each state's move", async () => {
  const mail = await notificationMail(BASE, {
    to: "ada@example.com",
    workspace: { name: "Acme", slug: "acme" },
    project: "Website",
    issue: {
      id: "i1",
      key: "WEB-12",
      title: "Fix the login page",
      state: { name: "In Progress", color: "#f2c94c" },
      priority: "high",
      assignee: "Bob",
      labels: [{ name: "Bug", color: "#eb5757" }],
      dueDate: "2026-10-20",
    },
    updates: [
      { actor: "Bob", kind: "commented", text: "Looks broken on Safari." },
      { actor: "Cy", kind: "state", from: "Todo", to: "In Progress" },
    ],
  });
  expect(mail.subject).toBe("WEB-12 Fix the login page");
  expect(mail.url).toBe(`${BASE}/acme/issues/i1`);
  expect(mail.text).toContain("Acme / Website / WEB-12");
  expect(mail.text).toContain("In Progress · High · Bob · Due 20 Oct 2026 · Bug");
  expect(mail.text).toContain("Looks broken on Safari.");
  expect(mail.text).toContain("Cy changed the state: Todo → In Progress");
  expect(mail.text).toContain(`${BASE}/acme/settings/notifications`);
});

test("quoted Markdown reads as the app shows it", () => {
  expect(
    plainText("Ask [@Ada](mention:u1) about **this** [link](https://x.test) and `code`\n\n![shot](/files/a)"),
  ).toBe("Ask @Ada about this link and code\n\n[image: shot]");
  expect(plainText("x".repeat(700))).toHaveLength(600);
});

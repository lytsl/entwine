import { expect } from "@playwright/test";

/** What the browser suite's mail sink kept of a message. */
interface Mail {
  to: string;
  subject: string;
  source: string;
}

const messages = async (): Promise<Mail[]> => (await fetch("http://127.0.0.1:3026/messages")).json();

/** The latest mail to `to` whose subject is `subject`, once the server has sent it; none older than `since`. */
export async function mailTo(to: string, subject: string, since = 0): Promise<Mail> {
  let found: Mail | undefined;
  await expect
    .poll(async () => {
      found = (await messages()).slice(since).findLast((m) => m.to === to && m.subject === subject);
      return found;
    })
    .toBeTruthy();
  return found!;
}

/** How many mails the sink holds: a later `mailTo` given it finds only newer ones. */
export const mailCount = async () => (await messages()).length;

/** The mail's link to the app, as a path a page can go to. */
export function linkIn(mail: Mail, contains: string): string {
  const url = mail.source.match(/https?:\/\/localhost:3000\/[^\s"<>]+/g)?.find((link) => link.includes(contains));
  if (!url) throw new Error(`No link with ${contains} in "${mail.subject}"`);
  const { pathname, search } = new URL(url.replace(/&amp;/g, "&"));
  return pathname + search;
}

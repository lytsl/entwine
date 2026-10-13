import { render } from "@react-email/components";
import { createTransport } from "nodemailer";
import type { ReactElement } from "react";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** The link the mail is for, which the console prints. */
  url: string;
}

/** Resolves once delivered or once a failure is logged: a mailer never throws. */
export type Mailer = (mail: Mail) => void | Promise<void>;

export const consoleMailer: Mailer = (mail) => console.log(`[mail] to ${mail.to}: ${mail.subject}\n  ${mail.url}`);

/** `url` is nodemailer's SMTP address: `smtps://user:password@smtp.example.com:465`. */
export function smtpMailer(url: string, from: string): Mailer {
  const transport = createTransport(url, { from });
  return async (mail) => {
    try {
      await transport.sendMail({ to: mail.to, subject: mail.subject, html: mail.html, text: mail.text });
    } catch (error) {
      console.error(
        `[mail] could not send "${mail.subject}" to ${mail.to}: ${(error as Error).message}\n  ${mail.url}`,
      );
    }
  };
}

/** The HTML, and the plain text that clients without HTML show, of one template. */
export const renderMail = async (to: string, subject: string, url: string, body: ReactElement): Promise<Mail> => ({
  to,
  subject,
  url,
  html: await render(body),
  text: await render(body, { plainText: true }),
});

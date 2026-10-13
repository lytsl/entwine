import { appLink } from "../app-link";
import { FallbackLink } from "../components/fallback-link";
import { Footer } from "../components/footer";
import { Intro } from "../components/intro";
import { MailButton } from "../components/mail-button";
import { MailShell } from "../components/mail-shell";
import { Note } from "../components/note";
import { RequestDetails } from "../components/request-details";
import { renderMail } from "../mailer";

/** The link's lifetime is Better Auth's default, an hour. */
export function resetPasswordMail(
  baseURL: string,
  user: { name: string; email: string },
  url: string,
  request?: Request,
) {
  const app = appLink(baseURL);
  return renderMail(
    user.email,
    "Reset your entwine password",
    url,
    <MailShell
      title="Reset your password"
      preview="Use the link inside to choose a new password. It expires in 1 hour."
    >
      <Intro
        title="Reset your password"
        subtitle={`Hi ${user.name}, use the button below to choose a new password. The link works once and expires in 1 hour.`}
      />
      <MailButton href={url}>Reset password</MailButton>
      <FallbackLink href={url} />
      <RequestDetails email={user.email} instance={app.label} request={request} />
      <Note title="Didn't ask for this?">
        You can ignore this mail. Your password stays the same until someone opens this link and sets a new one.
      </Note>
      <Footer
        title="entwine security mail"
        reason={`Sent to ${user.email} because someone asked to reset the password on ${app.label}.`}
        links={[app]}
      />
    </MailShell>,
  );
}

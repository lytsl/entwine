import { appLink } from "../app-link";
import { FallbackLink } from "../components/fallback-link";
import { Footer } from "../components/footer";
import { Intro } from "../components/intro";
import { MailButton } from "../components/mail-button";
import { MailShell } from "../components/mail-shell";
import { Note } from "../components/note";
import { RequestDetails } from "../components/request-details";
import { renderMail } from "../mailer";

/** To the address being replaced: once its holder confirms, the new address is sent a link that makes the change. */
export function changeEmailMail(
  baseURL: string,
  user: { name: string; email: string },
  newEmail: string,
  url: string,
  request?: Request,
) {
  const app = appLink(baseURL);
  return renderMail(
    user.email,
    "Confirm your new email address",
    url,
    <MailShell title="Confirm your new email address" preview={`Someone asked to change your address to ${newEmail}.`}>
      <Intro
        title="Confirm your new email address"
        subtitle={`Hi ${user.name}, someone asked to change the address of your account from ${user.email} to ${newEmail}. Confirm it, and a link to finish the change goes to ${newEmail}.`}
      />
      <MailButton href={url}>Confirm change</MailButton>
      <FallbackLink href={url} />
      <RequestDetails email={user.email} instance={app.label} request={request} />
      <Note title="Didn't ask for this?">
        Ignore this mail and your address stays as it is. Then change your password: someone may be signed in as you.
      </Note>
      <Footer
        title="entwine security mail"
        reason={`Sent to ${user.email} because someone asked to change the address of this account on ${app.label}.`}
        links={[app]}
      />
    </MailShell>,
  );
}

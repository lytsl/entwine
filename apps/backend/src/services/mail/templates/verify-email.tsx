import { appLink } from "../app-link";
import { FallbackLink } from "../components/fallback-link";
import { Footer } from "../components/footer";
import { Intro } from "../components/intro";
import { MailButton } from "../components/mail-button";
import { MailShell } from "../components/mail-shell";
import { Note } from "../components/note";
import { renderMail } from "../mailer";

/** To a new account's address, or to the address an account is changing to. */
export function verifyEmailMail(baseURL: string, user: { name: string; email: string }, url: string) {
  const app = appLink(baseURL);
  return renderMail(
    user.email,
    "Verify your email address",
    url,
    <MailShell title="Verify your email address" preview={`Confirm that ${user.email} is yours.`}>
      <Intro
        title="Verify your email address"
        subtitle={`Hi ${user.name}, confirm that ${user.email} is yours, so entwine can mail you notifications. The link expires in 1 hour.`}
      />
      <MailButton href={url}>Verify email</MailButton>
      <FallbackLink href={url} />
      <Note title="Not you?">
        Someone may have typed your address by mistake. You can ignore this mail: nothing more is sent to an address
        until it is verified.
      </Note>
      <Footer
        title="entwine account mail"
        reason={`Sent to ${user.email} because an account on ${app.label} gave this address.`}
        links={[app]}
      />
    </MailShell>,
  );
}

import { ROLE_LABELS, type Role } from "@entwine/shared";
import { appLink } from "../app-link";
import { Details } from "../components/details";
import { FallbackLink } from "../components/fallback-link";
import { Footer } from "../components/footer";
import { Intro } from "../components/intro";
import { MailButton } from "../components/mail-button";
import { MailShell } from "../components/mail-shell";
import { Note } from "../components/note";
import { formatTime } from "../format";
import { renderMail } from "../mailer";

/** What Better Auth gives `sendInvitationEmail`. */
export interface Invitation {
  id: string;
  email: string;
  role: string;
  organization: { name: string };
  inviter: { user: { name: string; email: string } };
  invitation: { expiresAt: Date };
}

export function invitationMail(baseURL: string, invitation: Invitation) {
  const app = appLink(baseURL);
  const url = `${app.href}/invite/${invitation.id}`;
  const workspace = invitation.organization.name;
  const inviter = invitation.inviter.user;
  const title = `Join ${workspace}`;
  return renderMail(
    invitation.email,
    `${inviter.name} invited you to join ${workspace} on entwine`,
    url,
    <MailShell title={title} preview={`You're invited to ${workspace} on entwine`}>
      <Intro title={title} subtitle={`${inviter.name} (${inviter.email}) invited you to work with them in entwine.`} />
      <MailButton href={url}>Accept invitation</MailButton>
      <FallbackLink href={url} />
      <Details
        title="Invitation details"
        rows={[
          ["Sent to", invitation.email],
          ["Role", ROLE_LABELS[invitation.role as Role] ?? invitation.role],
          ["Expires", formatTime(new Date(invitation.invitation.expiresAt))],
        ]}
      />
      <Note>
        Sign in, or sign up, with the address this mail was sent to. If you were not expecting it, you can ignore it.
      </Note>
      <Footer
        title="entwine workspace invitation"
        reason={`Sent to ${invitation.email} because ${inviter.name} invited this address to ${workspace}.`}
        links={[app]}
      />
    </MailShell>,
  );
}

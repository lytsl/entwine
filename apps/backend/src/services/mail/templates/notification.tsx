import { NOTIFICATION_TEXT } from "@entwine/shared";
import { Text } from "@react-email/components";
import { headline } from "../../delivery/headline";
import { appLink } from "../app-link";
import { Footer } from "../components/footer";
import { Intro } from "../components/intro";
import { IssueCard, type MailIssue } from "../components/issue-card";
import { MailButton } from "../components/mail-button";
import { MailShell } from "../components/mail-shell";
import { colors } from "../components/tokens";
import { type MailUpdate, UpdateItem } from "../components/update-item";
import { renderMail } from "../mailer";

export interface Digest {
  to: string;
  workspace: { name: string; slug: string };
  project: string;
  issue: MailIssue;
  /** Oldest first. */
  updates: MailUpdate[];
}

const names = (actors: string[]) =>
  actors.length === 1 ? actors[0] : `${actors.slice(0, -1).join(", ")} and ${actors[actors.length - 1]}`;

/** One member's unread notifications of one issue. */
export function notificationMail(baseURL: string, digest: Digest) {
  const app = appLink(baseURL);
  const { issue, updates, workspace } = digest;
  const url = `${app.href}/${workspace.slug}/issues/${issue.id}`;
  const settings = `${app.href}/${workspace.slug}/settings/notifications`;
  const [first] = updates;
  const title = updates.length === 1 ? headline(first, issue.key) : `${updates.length} updates on ${issue.key}`;
  const actors = [...new Set(updates.map((update) => update.actor))];
  return renderMail(
    digest.to,
    `${issue.key} ${issue.title}`,
    url,
    <MailShell
      title={title}
      preview={`${first.actor} ${NOTIFICATION_TEXT[first.kind]}${first.text ? `: ${first.text.slice(0, 120)}` : ""}`}
    >
      <Text className="m-muted" style={breadcrumb}>
        {workspace.name} / {digest.project} / {issue.key}
      </Text>
      <Intro title={title} subtitle={updates.length > 1 ? `From ${names(actors)}.` : undefined} />
      <IssueCard issue={issue} />
      {updates.map((update, position) => (
        <UpdateItem key={position} update={update} />
      ))}
      <Text style={spacer} />
      <MailButton href={url}>Open issue</MailButton>
      <Text style={spacer} />
      <Footer
        title="entwine notification"
        reason={`Sent to ${digest.to} because you follow ${issue.key} in ${workspace.name}, and read none of this in the app.`}
        links={[{ label: "Manage notifications", href: settings }, app]}
      />
    </MailShell>,
  );
}

const breadcrumb = { margin: "0 0 6px", color: colors.muted, fontSize: "13px", lineHeight: "20px" };
const spacer = { margin: "0", height: "16px" };

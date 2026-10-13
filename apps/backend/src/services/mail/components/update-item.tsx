import { NOTIFICATION_TEXT, type NotificationKind } from "@entwine/shared";
import { Section, Text } from "@react-email/components";
import { colors } from "./tokens";

/** One notification as a mail tells it: who did what, and what they wrote or where the issue moved. */
export interface MailUpdate {
  actor: string;
  kind: NotificationKind;
  /** The comment, or the text that mentions the reader, as plain text. */
  text?: string;
  /** The state names a state change moved between. */
  from?: string;
  to?: string;
}

export function UpdateItem({ update }: { update: MailUpdate }) {
  return (
    <Section style={wrapper}>
      <Text className="m-text" style={headline}>
        <strong>{update.actor}</strong> {NOTIFICATION_TEXT[update.kind]}
        {update.from && update.to ? `: ${update.from} → ${update.to}` : ""}
      </Text>
      {update.text && (
        <Text className="m-text m-divider" style={quote}>
          {update.text}
        </Text>
      )}
    </Section>
  );
}

const wrapper = { margin: "0 0 14px" };
const headline = { margin: "0", color: colors.foreground, fontSize: "14px", lineHeight: "22px" };
const quote = {
  margin: "6px 0 0",
  padding: "2px 0 2px 12px",
  borderLeft: `3px solid ${colors.border}`,
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "22px",
  whiteSpace: "pre-wrap" as const,
};

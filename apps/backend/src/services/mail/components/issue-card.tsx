import { PRIORITY_LABELS, type Priority } from "@entwine/shared";
import { Section, Text } from "@react-email/components";
import { colors } from "./tokens";

export interface MailIssue {
  id: string;
  key: string;
  title: string;
  state: { name: string; color: string };
  priority: Priority;
  assignee?: string;
  labels: { name: string; color: string }[];
  /** A calendar date, `2026-10-14`. */
  dueDate?: string | null;
}

const day = (date: string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

/** Dots are the colours the app shows the state and labels in. */
function Dot({ color }: { color: string }) {
  return <span style={{ ...dot, backgroundColor: color }} />;
}

export function IssueCard({ issue }: { issue: MailIssue }) {
  const facts = [
    <>
      <Dot color={issue.state.color} />
      {issue.state.name}
    </>,
    issue.priority !== "none" && PRIORITY_LABELS[issue.priority],
    issue.assignee ?? "Unassigned",
    issue.dueDate && `Due ${day(issue.dueDate)}`,
    ...issue.labels.map((label) => (
      <>
        <Dot color={label.color} />
        {label.name}
      </>
    )),
  ].filter(Boolean);
  return (
    <Section className="m-panel" style={card}>
      <Text className="m-muted" style={key}>
        {issue.key}
      </Text>
      <Text className="m-text" style={title}>
        {issue.title}
      </Text>
      <Text className="m-muted" style={line}>
        {facts.map((fact, position) => (
          <span key={position} style={chip}>
            {position > 0 && " · "}
            {fact}
          </span>
        ))}
      </Text>
    </Section>
  );
}

const card = {
  borderRadius: "12px",
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.panel,
  padding: "16px 18px",
  margin: "0 0 24px",
};
const key = { margin: "0", color: colors.muted, fontSize: "12px", lineHeight: "18px", fontWeight: "500" };
const title = {
  margin: "2px 0 10px",
  color: colors.foreground,
  fontSize: "16px",
  lineHeight: "24px",
  fontWeight: "600",
};
const line = { margin: "0", color: colors.muted, fontSize: "13px", lineHeight: "22px" };
const chip = { whiteSpace: "nowrap" as const };
const dot = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "4px",
  marginRight: "6px",
  verticalAlign: "1px",
};

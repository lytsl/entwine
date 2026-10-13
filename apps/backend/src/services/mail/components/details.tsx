import { Heading, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { colors } from "./tokens";

/** Labelled values in a panel; a row without a value is left out. */
export function Details({ title, rows }: { title: string; rows: [label: string, value: ReactNode][] }) {
  const shown = rows.filter(([, value]) => value);
  if (!shown.length) return null;
  return (
    <Section className="m-panel" style={panel}>
      <Heading as="h2" className="m-text" style={heading}>
        {title}
      </Heading>
      {shown.map(([label, value]) => (
        // Inline rather than table cells, so that the plain-text part keeps a space between label and value.
        <Text key={label} className="m-text" style={row}>
          <span className="m-muted" style={labelStyle}>
            {label}
          </span>{" "}
          {value}
        </Text>
      ))}
    </Section>
  );
}

const panel = {
  borderRadius: "12px",
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.panel,
  padding: "14px 18px",
};
const heading = {
  margin: "0 0 6px",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "600",
};
const row = {
  margin: "0",
  color: colors.foreground,
  fontSize: "13px",
  lineHeight: "24px",
  wordBreak: "break-word" as const,
};
const labelStyle = { display: "inline-block", width: "110px", color: colors.muted };

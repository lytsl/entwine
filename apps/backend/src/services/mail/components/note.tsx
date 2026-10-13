import { Heading, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { colors } from "./tokens";

export function Note({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Section style={wrapper}>
      {title && (
        <Heading as="h2" className="m-text" style={heading}>
          {title}
        </Heading>
      )}
      <Text className="m-muted" style={body}>
        {children}
      </Text>
    </Section>
  );
}

const wrapper = { margin: "28px 0 32px" };
const heading = {
  margin: "0 0 4px",
  color: colors.foreground,
  fontSize: "14px",
  lineHeight: "22px",
  fontWeight: "500",
};
const body = { margin: "0", color: colors.muted, fontSize: "14px", lineHeight: "22px" };

import { Heading, Text } from "@react-email/components";
import { colors } from "./tokens";

export function Intro({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Heading as="h1" className="m-text" style={heading}>
        {title}
      </Heading>
      {subtitle && (
        <Text className="m-muted" style={subtitleStyle}>
          {subtitle}
        </Text>
      )}
    </>
  );
}

const heading = {
  margin: "0 0 8px",
  color: colors.foreground,
  fontSize: "22px",
  lineHeight: "30px",
  fontWeight: "600",
  letterSpacing: "-0.4px",
};
const subtitleStyle = { margin: "0 0 24px", color: colors.muted, fontSize: "14px", lineHeight: "22px" };

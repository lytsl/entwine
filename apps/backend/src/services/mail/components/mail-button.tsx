import { Button } from "@react-email/components";
import type { ReactNode } from "react";
import { colors, fontFamily } from "./tokens";

export function MailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button href={href} className="m-btn" style={button}>
      {children}
    </Button>
  );
}

const button = {
  display: "inline-block",
  padding: "9px 16px",
  borderRadius: "8px",
  border: `1px solid ${colors.primary}`,
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  fontFamily,
  fontSize: "14px",
  lineHeight: "20px",
  fontWeight: "500",
  textDecoration: "none",
};

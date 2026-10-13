import { Link, Section, Text } from "@react-email/components";
import { Fragment } from "react";
import { colors } from "./tokens";

/** What kind of mail this is, why it reached this address, and where to go from it. */
export function Footer({
  title,
  reason,
  links,
}: {
  title: string;
  reason: string;
  links: { label: string; href: string }[];
}) {
  return (
    <Section className="m-divider" style={wrapper}>
      <Text className="m-text" style={titleStyle}>
        {title}
      </Text>
      <Text className="m-muted" style={reasonStyle}>
        {reason}
      </Text>
      <Text style={linksStyle}>
        {links.map((link, position) => (
          <Fragment key={link.href}>
            {position > 0 && <span style={spacer}> </span>}
            <Link href={link.href} className="m-link" style={linkStyle}>
              {link.label}
            </Link>
          </Fragment>
        ))}
      </Text>
    </Section>
  );
}

const wrapper = { borderTop: `1px solid ${colors.border}`, paddingTop: "20px" };
const titleStyle = { margin: "0", color: colors.foreground, fontSize: "12px", lineHeight: "18px", fontWeight: "500" };
const reasonStyle = { margin: "2px 0 0", color: colors.muted, fontSize: "12px", lineHeight: "18px" };
const linksStyle = { margin: "8px 0 0", fontSize: "12px", lineHeight: "18px" };
const spacer = { display: "inline-block", width: "16px" };
const linkStyle = { color: colors.foreground, fontWeight: "500", textDecoration: "underline" };

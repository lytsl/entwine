import { Link, Text } from "@react-email/components";
import { colors } from "./tokens";

/** For the clients that render the button as nothing a reader can press. */
export function FallbackLink({ href }: { href: string }) {
  return (
    <>
      <Text className="m-muted" style={label}>
        If the button does not work, paste this link into your browser:
      </Text>
      <Text style={wrapper}>
        <Link href={href} className="m-link" style={link}>
          {href}
        </Link>
      </Text>
    </>
  );
}

const label = { margin: "16px 0 2px", color: colors.muted, fontSize: "12px", lineHeight: "18px" };
const wrapper = { margin: "0 0 28px", fontSize: "12px", lineHeight: "18px", wordBreak: "break-all" as const };
const link = { color: colors.foreground, textDecoration: "underline" };

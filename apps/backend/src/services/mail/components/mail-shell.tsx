import { Body, Column, Container, Head, Html, Preview, Row } from "@react-email/components";
import type { ReactNode } from "react";
import { colors, fontFamily, themeCss } from "./tokens";

/** `preview` is the line an inbox shows after the subject. */
export function MailShell({ title, preview, children }: { title: string; preview: string; children: ReactNode }) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <title>{title}</title>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
        <style>{themeCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="m-bg" style={body}>
        {/* React Email puts the body's style on an element inside it, which the dark class must repaint too. */}
        <div role="article" aria-label={title} className="m-bg" style={page}>
          <Container style={container}>
            <Row style={brand}>
              <Column style={markCell}>
                <div className="m-btn" style={mark}>
                  e
                </div>
              </Column>
              <Column className="m-text" style={wordmark}>
                entwine
              </Column>
            </Row>
            {children}
          </Container>
        </div>
      </Body>
    </Html>
  );
}

const body = { margin: "0", padding: "0", backgroundColor: colors.background, color: colors.foreground, fontFamily };
const page = { backgroundColor: colors.background };
const container = { maxWidth: "560px", margin: "0 auto", padding: "40px 24px 48px" };
const brand = { marginBottom: "32px" };
const markCell = { width: "36px", verticalAlign: "middle" as const };
const mark = {
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  fontSize: "15px",
  fontWeight: "600",
  lineHeight: "28px",
  textAlign: "center" as const,
};
const wordmark = {
  verticalAlign: "middle" as const,
  color: colors.foreground,
  fontSize: "16px",
  fontWeight: "600",
};

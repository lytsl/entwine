/** The app's colours in hex: mail clients read neither `oklch` nor custom properties. */
export const colors = {
  background: "#ffffff",
  foreground: "#18181b",
  muted: "#686870",
  primary: "#4d57dc",
  primaryForeground: "#fcfcfc",
  border: "#e4e4e7",
  panel: "#f6f6f8",
} as const;

const dark = {
  background: "#121214",
  foreground: "#eeeef0",
  muted: "#9797a0",
  primary: "#5866e5",
  border: "#262629",
  panel: "#19191c",
} as const;

export const fontFamily =
  '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Styles are inline, for the clients that drop `<style>`; these classes repaint them where the reader prefers dark,
 * and in Outlook's dark mode, which marks the body with `data-ogsc`/`data-ogsb`.
 */
const rules: [string, string][] = [
  [".m-bg", `background-color:${dark.background}`],
  [".m-text", `color:${dark.foreground}`],
  [".m-muted", `color:${dark.muted}`],
  [".m-panel", `background-color:${dark.panel};border-color:${dark.border}`],
  [".m-divider", `border-color:${dark.border}`],
  [".m-link", `color:${dark.foreground}`],
  [".m-btn", `background-color:${dark.primary};border-color:${dark.primary}`],
];

const important = (declarations: string) =>
  declarations
    .split(";")
    .map((declaration) => `${declaration}!important`)
    .join(";");

export const themeCss = [
  ":root{color-scheme:light dark;supported-color-schemes:light dark}",
  // iOS turns dates and addresses into links of its own colour.
  "a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}",
  "@media (prefers-color-scheme: dark){",
  rules.map(([selector, declarations]) => `${selector}{${important(declarations)}}`).join(""),
  "}",
  rules
    .map(([selector, declarations]) => `[data-ogsc] ${selector},[data-ogsb] ${selector}{${important(declarations)}}`)
    .join(""),
].join("");

/** The first that matches names it: Edge's agent also says Chrome, and Chrome's says Safari. */
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/\biPhone\b/, "iPhone"],
  [/\biPad\b/, "iPad"],
  [/\bAndroid\b/, "Android"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMacintosh\b|\bMac OS X\b/, "macOS"],
  [/\bWindows\b/, "Windows"],
  [/\bLinux\b/, "Linux"],
];

const match = (agent: string, patterns: [RegExp, string][]) => patterns.find(([pattern]) => pattern.test(agent))?.[1];

/** "Firefox on Linux", from what the browser says of itself. */
export function describeDevice(userAgent: string | null | undefined): string | undefined {
  // An agent is a header of the client's choosing: a bounded one is read.
  const agent = userAgent?.slice(0, 512) ?? "";
  const browser = match(agent, BROWSERS);
  const system = match(agent, SYSTEMS);
  return browser && system ? `${browser} on ${system}` : (browser ?? system);
}

/** A reader's time zone is unknown to the server, so times are in UTC, and say so. */
export const formatTime = (at: Date): string =>
  `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(at)} UTC`;

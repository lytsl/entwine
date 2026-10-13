/** Stored form of the text: LF line ends, no runs of blank lines, no blank lines at either end. */
export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();
}

/** Web and mail addresses only; anything else (`javascript:`, `data:`, relative paths) is refused. */
export function isSafeUrl(url: string): boolean {
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** An address typed into the link prompt: `example.com` means https, `ada@example.com` means mail. */
export function linkTarget(input: string): string | null {
  const text = input.trim();
  if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(text)) return `mailto:${text}`;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  return isSafeUrl(url) ? url : null;
}

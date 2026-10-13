const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

/** Whether every word of `query` appears in one of `texts`, ignoring case; an empty query matches everything. */
export function matches(query: string, texts: readonly string[]): boolean {
  const haystack = texts.join(" ").toLowerCase();
  return words(query).every((word) => haystack.includes(word));
}

/**
 * Best first: the key typed exactly, then keys starting with it, then keys and titles holding every word typed.
 * Within each rank, `issues` keep their order. Nothing is found for an empty query.
 */
export function searchIssues<T>(
  query: string,
  issues: readonly T[],
  describe: (issue: T) => { key: string; title: string },
  limit = 20,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const ranked: { issue: T; rank: number }[] = [];
  for (const issue of issues) {
    const { key, title } = describe(issue);
    const k = key.toLowerCase();
    const rank = k === q ? 0 : k.startsWith(q) ? 1 : matches(q, [key, title]) ? 2 : -1;
    if (rank >= 0) ranked.push({ issue, rank });
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((r) => r.issue);
}

/** The text around the first of `query`'s words in `text`, on one line. */
export function excerpt(text: string, query: string, around = 40): string {
  const line = text.replace(/\s+/g, " ").trim();
  const at = Math.max(0, line.toLowerCase().indexOf(words(query)[0] ?? ""));
  const from = Math.max(0, at - around);
  return `${from ? "…" : ""}${line.slice(from, at + 2 * around)}${at + 2 * around < line.length ? "…" : ""}`;
}

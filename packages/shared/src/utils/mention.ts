/**
 * A mention in the Markdown of a description or comment is `[@Name](mention:<member id>)`: the name as it was, for
 * wherever the text is read raw, and the id, by which a rename follows. The editor writes `[` as `\[` when it is
 * typed, so an escaped one starts no mention.
 */
const MENTION = /(?<!\\)\[@[^\]\n]*\]\(mention:([\w-]+)\)/;
/**
 * Code, which is shown as typed: a fenced block, to its closing fence or to the end of the text, or a code span, which
 * as many backticks close as open, in the same paragraph.
 */
const CODE =
  /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[`~]*[ \t]*$|(?![\s\S]))|(?<![\\`])(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\2(?!`)/;
/**
 * Read in one pass, so whichever starts first holds what follows it, as it does where the text is shown: a mention
 * written out in code addresses nobody. The mention's id is the third group, after the two of the code.
 */
const CODE_OR_MENTION = new RegExp(`${CODE.source}|${MENTION.source}`, "gm");

/** The ids a text mentions, each once, in the order they first appear. */
export const mentionedIds = (text: string): string[] => [
  ...new Set(Array.from(text.matchAll(CODE_OR_MENTION), (match) => match[3] ?? []).flat()),
];

export const mentionMarkdown = (id: string, name: string): string =>
  `[@${name.replace(/[[\]\\\n]/g, "")}](mention:${id})`;

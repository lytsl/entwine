/**
 * A description's or comment's Markdown as a mail quotes it: what a reader sees, without the marks. A mention keeps
 * the name it was written with; an image says it is one, as the mail carries no workspace files.
 */
export function plainText(markdown: string, max = 600): string {
  const text = markdown
    .replace(/(?<!\\)\[@([^\]\n]*)\]\(mention:[\w-]+\)/g, "@$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => `[image${alt ? `: ${alt}` : ""}]`)
    .replace(/(?<!\\)\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*(?:`{3,}|~{3,}).*$/gm, "")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/(\*\*|__|~~|`)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(?<![\w*])[*_](?=\S)([^*_\n]*?\S)[*_](?![\w*])/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

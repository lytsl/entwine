import { Extension } from "@tiptap/core";

/**
 * Markdown may give a link any address: `[text](javascript:…)`, a relative path, a `mention:`. The link mark draws
 * one it refuses as a link to nowhere, which a click follows to the page itself. Read here first, such a link is its
 * text alone.
 */
export const refusedLinks = (allowed: (url: string) => boolean) =>
  Extension.create({
    name: "refusedLinks",
    // Ahead of the link mark (1000): the first reader of a Markdown token is the one asked.
    priority: 1001,
    markdownTokenName: "link",
    parseMarkdown: (token, helpers) => {
      const text = helpers.parseInline(token.tokens ?? []);
      return allowed(token.href ?? "")
        ? helpers.applyMark("link", text, { href: token.href, title: token.title || null })
        : text;
    },
  });

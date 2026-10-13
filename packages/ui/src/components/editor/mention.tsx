import { Node } from "@tiptap/core";

/** Someone a text can mention. This package does not know what a member is. */
export type MentionPerson = {
  id: string;
  name: string;
  /** Offered in the `@` menu. Someone who left is not, and their mentions still show their name. */
  suggested: boolean;
};

/** What a chip shows: the person's name now, or the one stored with the mention when the id is nobody's. */
const chipText = (names: ReadonlyMap<string, string>, id: string, label: string) => `@${names.get(id) ?? label}`;

export function showMentionNames(root: HTMLElement, names: ReadonlyMap<string, string>): void {
  for (const chip of root.querySelectorAll<HTMLElement>("[data-mention]"))
    chip.textContent = chipText(names, chip.dataset.mention ?? "", chip.dataset.label ?? "");
}

/**
 * A mention is one inline node, kept in Markdown as `[@Name](mention:<id>)`: text any reader shows as "@Name". It
 * is read before links are, and is never one: the address goes nowhere, and the link mark, which takes web and
 * mail addresses only, does not see it. `[`, `]` and `\` are left out of the stored name, which would end it early.
 */
export const mentionNode = (names: () => ReadonlyMap<string, string>) =>
  Node.create({
    name: "mention",
    group: "inline",
    inline: true,
    atom: true,
    selectable: false,
    addAttributes: () => ({ id: { default: "" }, label: { default: "" } }),
    parseHTML: () => [
      {
        tag: "span[data-mention]",
        getAttrs: (element) => ({ id: element.dataset.mention ?? "", label: element.dataset.label ?? "" }),
      },
    ],
    renderHTML: ({ node }) => [
      "span",
      { class: "mention", "data-mention": node.attrs.id, "data-label": node.attrs.label },
      chipText(names(), node.attrs.id, node.attrs.label),
    ],
    renderText: ({ node }) => chipText(names(), node.attrs.id, node.attrs.label),
    // The chip is redrawn by `showMentionNames` when a name changes, which is no edit of the text.
    addNodeView:
      () =>
      ({ node }) => {
        const dom = document.createElement("span");
        dom.className = "mention";
        dom.dataset.mention = node.attrs.id;
        dom.dataset.label = node.attrs.label;
        dom.textContent = chipText(names(), node.attrs.id, node.attrs.label);
        return { dom, ignoreMutation: () => true };
      },
    markdownTokenizer: {
      name: "mention",
      level: "inline",
      start: (source) => source.indexOf("[@"),
      tokenize(source) {
        const match = /^\[@([^\]\n]*)\]\(mention:([\w-]+)\)/.exec(source);
        return match ? { type: "mention", raw: match[0], label: match[1], id: match[2] } : undefined;
      },
    },
    parseMarkdown: (token) => ({ type: "mention", attrs: { id: token.id, label: token.label } }),
    renderMarkdown: (node) =>
      `[@${String(node.attrs?.label ?? "").replace(/[[\]\\\n]/g, "")}](mention:${node.attrs?.id ?? ""})`,
  });

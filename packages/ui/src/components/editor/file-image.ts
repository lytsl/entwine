import type { Editor } from "@tiptap/core";
import { mergeAttributes, Node } from "@tiptap/core";
import { isSafeUrl } from "../../lib/markdown";
import type { RichTextFiles } from "../../lib/rich-text-files";

/**
 * An image, in Markdown `![name](address)`, kept only when `owns` its address: text is written by members, and an
 * image from anywhere else would tell that place who reads it. Another image becomes a link to its address, or its
 * name when a link may not point there either. Only `src` and `alt` are read from an `<img>`.
 *
 * The text outlives its files: an image that does not load (its attachment was removed, or the server is out of
 * reach) is shown as its name, marked unavailable, instead of the browser's broken picture.
 */
export const fileImage = (owns: (url: string) => boolean) =>
  Node.create({
    name: "image",
    group: "inline",
    inline: true,
    draggable: true,
    addAttributes: () => ({ src: { default: null }, alt: { default: null } }),
    parseHTML: () => [
      { tag: "img[src]", getAttrs: (element) => (owns(element.getAttribute("src") ?? "") ? null : false) },
    ],
    renderHTML: ({ HTMLAttributes }) => ["img", mergeAttributes(HTMLAttributes, { loading: "lazy" })],
    addNodeView:
      () =>
      ({ node }) => {
        const dom = document.createElement("span");
        dom.className = "file-image";
        const image = document.createElement("img");
        image.alt = String(node.attrs.alt ?? "");
        image.loading = "lazy";
        image.addEventListener("error", () => {
          dom.dataset.unavailable = "";
          dom.textContent = `${image.alt || "Image"} (unavailable)`;
        });
        image.src = String(node.attrs.src ?? "");
        dom.append(image);
        return {
          dom,
          // What the view changes in itself is not an edit of the text.
          ignoreMutation: () => true,
          update: (next) => next.type === node.type && next.attrs.src === node.attrs.src,
        };
      },
    markdownTokenName: "image",
    parseMarkdown: (token, helpers) => {
      const src = String(token.href ?? "");
      const alt = String(token.text ?? "");
      if (owns(src)) return helpers.createNode("image", { src, alt });
      return helpers.createTextNode(alt || src, isSafeUrl(src) ? [{ type: "link", attrs: { href: src } }] : []);
    },
    renderMarkdown: (node) => `![${String(node.attrs?.alt ?? "").replace(/[[\]]/g, "")}](${node.attrs?.src ?? ""})`,
  });

/**
 * Attaches each file and puts it where the selection is by then: an image inline, any other file as a link. True
 * when the files were taken, so the editor does nothing else with the paste or drop.
 */
export function insertFiles(editor: Editor, files: RichTextFiles | undefined, list: FileList | undefined): boolean {
  const attach = files?.attach;
  if (!attach || !list?.length) return false;
  // The list is emptied when its event ends.
  const taken = [...list];
  void (async () => {
    for (const file of taken) {
      const added = await attach(file);
      if (!added || editor.isDestroyed) continue;
      editor
        .chain()
        .focus()
        .insertContent([
          added.image
            ? { type: "image", attrs: { src: added.url, alt: added.name } }
            : { type: "text", text: added.name, marks: [{ type: "link", attrs: { href: added.url } }] },
          { type: "text", text: " " },
        ])
        .run();
    }
  })();
  return true;
}

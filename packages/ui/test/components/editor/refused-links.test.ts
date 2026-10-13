import { expect, test } from "bun:test";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { mentionNode } from "../../../src/components/editor/mention";
import { refusedLinks } from "../../../src/components/editor/refused-links";
import { isSafeUrl } from "../../../src/lib/markdown";

const markdown = new MarkdownManager({
  extensions: [StarterKit, mentionNode(() => new Map()), refusedLinks(isSafeUrl)],
});
/** Each run of the text with the address it links to, or the mention it is. */
const read = (text: string) =>
  (markdown.parse(text).content?.[0]?.content ?? []).map((node) =>
    node.type === "mention"
      ? `@${node.attrs?.id}`
      : [node.text, ...(node.marks ?? []).map((mark) => mark.attrs?.href ?? mark.type)].join(" -> "),
  );

test("a link whose address is refused is read as its text, with its formatting", () => {
  expect(
    read("a [click](mention:x) [rel](/issues) [**js**](javascript:alert(1)) <data:x> [ok](https://e.com)"),
  ).toEqual(["a click rel ", "js -> bold", " data:x ", "ok -> https://e.com"]);
  expect(read("https://auto.example and <mailto:ada@example.com>")).toEqual([
    "https://auto.example -> https://auto.example",
    " and ",
    "mailto:ada@example.com -> mailto:ada@example.com",
  ]);
});

test("a mention is read ahead of links and code spans that start after it, and not inside code", () => {
  expect(read("[@Bob](mention:bob) [@B`o](mention:bo) `x")).toEqual(["@bob", " ", "@bo", " `x"]);
  expect(read("`[@Bob](mention:bob)`")).toEqual(["[@Bob](mention:bob) -> code"]);
});

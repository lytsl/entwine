import { expect, test } from "bun:test";
import { mentionedIds, mentionMarkdown } from "../../src";

test("a text's mentions are read by id, each once, in order", () => {
  const text = `Ask ${mentionMarkdown("bob", "Bob")} and ${mentionMarkdown("u_1-x", "Cy [the] \\ Younger")}, then [@Bob B.](mention:bob) again.`;
  expect(text).toContain("[@Cy the  Younger](mention:u_1-x)");
  expect(mentionedIds(text)).toEqual(["bob", "u_1-x"]);
});

test("links, escaped brackets and other addresses are not mentions", () => {
  for (const text of [
    "",
    "@bob",
    "[Bob](mention:bob)",
    "[@Bob](https://example.com/bob)",
    "\\[@Bob\\](mention:bob)",
    "[@Bob](mention:)",
    "[@Bob](mention:bob extra)",
    "[@Bo\nb](mention:bob)",
  ])
    expect(mentionedIds(text)).toEqual([]);
});

test("a mention written out in code addresses nobody; one beside the code does", () => {
  const bob = mentionMarkdown("bob", "Bob");
  const cy = mentionMarkdown("cy", "Cy");
  for (const code of [
    `\`${bob}\``,
    `\`\`a \` ${bob}\`\``,
    `\`\`\`\n${bob}\n\`\`\``,
    `\`\`\`md\n${bob}\n\n${bob}\n\`\`\`\``,
    `~~~\n${bob}\n~~~`,
    `- item\n\n    \`\`\`\n    ${bob}\n    \`\`\``,
    // A fence nothing closes runs to the end.
    `\`\`\`\n${bob}`,
  ]) {
    expect(mentionedIds(code)).toEqual([]);
    expect(mentionedIds(`${cy}\n\n${code}`)).toEqual(["cy"]);
  }
  expect(mentionedIds(`\`\`\`\n${bob}\n\`\`\`\n${cy}`)).toEqual(["cy"]);
  expect(mentionedIds(`\`a\` ${bob} \`b\` ${cy}`)).toEqual(["bob", "cy"]);
});

test("a backtick that opens no code hides nothing", () => {
  const bob = mentionMarkdown("bob", "Bob");
  for (const text of [
    `5\` wide, ${bob}`,
    `a \\\`${bob}\\\``,
    // Code does not run from one paragraph into the next.
    `one \` tick\n\n${bob} and \` another`,
    `\`\` two, ${bob}, \` one`,
    // The mention starts first, so the backticks are its name's.
    `${mentionMarkdown("bob", "B`o")} \`x`,
  ])
    expect(mentionedIds(text)).toEqual(["bob"]);
});

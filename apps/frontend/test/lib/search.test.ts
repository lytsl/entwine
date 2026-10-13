import { describe, expect, test } from "bun:test";
import { excerpt, matches, searchIssues } from "../../src/lib/search";

const issues = [
  { key: "API-20", title: "Paginate the list endpoints" },
  { key: "WEB-2", title: "Fix broken footer links" },
  { key: "API-2", title: "Document pagination" },
  { key: "WEB-7", title: "Build the new layout" },
];
const find = (query: string) => searchIssues(query, issues, (i) => i).map((i) => i.key);

describe("palette issue search", () => {
  test("finds an issue by its key, the exact key first", () => {
    expect(find("api-2")).toEqual(["API-2", "API-20"]);
    expect(find("WEB-2")).toEqual(["WEB-2"]);
  });

  test("finds an issue by words of its title, in any order", () => {
    expect(find("footer links")).toEqual(["WEB-2"]);
    expect(find("links footer")).toEqual(["WEB-2"]);
    expect(find("footer layout")).toEqual([]);
  });

  test("finds nothing for an empty query", () => {
    expect(find("  ")).toEqual([]);
  });

  test("keeps the given order within a rank, up to the limit", () => {
    expect(find("pagina")).toEqual(["API-20", "API-2"]);
    expect(searchIssues("pagina", issues, (i) => i, 1)).toHaveLength(1);
  });
});

describe("matches", () => {
  test("every word must appear, ignoring case", () => {
    expect(matches("board LAY", ["Board layout", "switch layout"])).toBe(true);
    expect(matches("board theme", ["Board layout"])).toBe(false);
    expect(matches("", ["anything"])).toBe(true);
  });
});

describe("excerpt", () => {
  test("is the text around the first word, on one line, cut where it goes on", () => {
    const text = `${"Lead in. ".repeat(10)}The footer
overlaps   the sidebar. ${"Trailing words. ".repeat(10)}`;
    const shown = excerpt(text, "FOOTER sidebar", 20);
    expect(shown).toStartWith("…");
    expect(shown).toContain("The footer overlaps the sidebar.");
    expect(shown).toEndWith("…");
    expect(excerpt("Short footer note", "footer")).toBe("Short footer note");
  });
});

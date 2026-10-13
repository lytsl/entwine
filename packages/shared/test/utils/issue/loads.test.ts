import { describe, expect, test } from "bun:test";
import { issueSearchQueries, searchRank } from "../../../src";

const projects = [{ id: "p1", identifier: "WEB" }];

describe("issue search", () => {
  test("asks nothing under two characters, and for a key only when it is typed whole", () => {
    expect(issueSearchQueries(" a ", projects, 30)).toEqual([]);
    const byKey = { model: "Issue", where: { projectId: "p1", number: 12 } };
    expect(issueSearchQueries("web-12", projects, 30)[0]).toEqual(byKey);
    expect(issueSearchQueries("web-1x", projects, 30)).not.toContainEqual(byKey);
    expect(issueSearchQueries("api-12", projects, 30)).toHaveLength(4);
  });

  test("asks for the latest issues by title, description and comment, of at most ten words", () => {
    const queries = issueSearchQueries("  Fix   the footer ", projects, 30);
    const latest = { order: [{ field: "updatedAt", desc: true }], limit: 30 };
    const contains = ["Fix", "the", "footer"];
    expect(queries).toEqual([
      { model: "Issue", where: { archivedAt: null, title: { contains } }, ...latest },
      { model: "Issue", where: { archivedAt: null, description: { contains } }, ...latest },
      { model: "Comment", where: { body: { contains } }, ...latest },
      {
        model: "Issue",
        where: {
          archivedAt: null,
          id: { model: "Comment", select: "issueId", where: { body: { contains } }, ...latest },
        },
      },
    ]);
    const many = issueSearchQueries(Array.from({ length: 14 }, (_, n) => `w${n}`).join(" "), projects, 30);
    expect((many[0].where?.title as { contains: string[] }).contains).toHaveLength(10);
  });

  test("ranks a found issue by the best thing that holds every word", () => {
    const issue = { key: "WEB-12", title: "Fix the footer", description: "It overlaps the sidebar", comments: [] };
    expect(searchRank("web-12", issue)).toBe("key");
    expect(searchRank("WEB-1", issue)).toBe("title");
    expect(searchRank("footer FIX", issue)).toBe("title");
    expect(searchRank("sidebar overlaps", issue)).toBe("description");
    expect(searchRank("footer sidebar", issue)).toBeUndefined();
    expect(searchRank("wombat", { ...issue, comments: ["no", "A Wombat chewed it"] })).toBe("comment");
    expect(searchRank("  ", issue)).toBeUndefined();
  });
});

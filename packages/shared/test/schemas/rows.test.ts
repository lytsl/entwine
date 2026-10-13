import { expect, test } from "bun:test";
import { MODULE_STATUSES, type Row, rowSchemas } from "../../src";

test("row types come from the row schemas", () => {
  const member: Row<"Member"> = {
    id: "u",
    name: "Ada",
    email: "a@example.com",
    image: null,
    role: "owner",
    removed: 0,
  };
  // @ts-expect-error `nickname` is not a Member column.
  const wrong: Row<"Member"> = { ...member, nickname: "A" };
  expect(wrong.id).toBe("u");
});

test("row schemas normalize what clients send", () => {
  const project = rowSchemas.Project.pick({ identifier: true, name: true });
  expect(project.parse({ identifier: " web ", name: " Website " })).toEqual({ identifier: "WEB", name: "Website" });
  expect(project.safeParse({ identifier: "TOOLONG", name: "x" }).success).toBe(false);
  expect(rowSchemas.Issue.shape.dueDate.safeParse("2026-02-30").success).toBe(false);
});

test("links are http or https addresses", () => {
  const link = { id: "l", issueId: "i", title: "", creatorId: "u", createdAt: 0 };
  expect(rowSchemas.IssueLink.safeParse({ ...link, url: "https://example.com/a" }).success).toBe(true);
  expect(rowSchemas.IssueLink.safeParse({ ...link, url: "javascript:alert(1)" }).success).toBe(false);
  expect(rowSchemas.IssueLink.safeParse({ ...link, url: "example.com" }).success).toBe(false);
});

test("modules have their statuses", () => {
  expect(MODULE_STATUSES).toEqual(["backlog", "planned", "in_progress", "paused", "completed", "cancelled"]);
  expect(rowSchemas.Module.shape.status.safeParse("shipping").success).toBe(false);
});

test("plan names are trimmed, 1–100 characters, and dates are calendar dates", () => {
  const name = rowSchemas.Cycle.shape.name;
  expect(name.parse("  Sprint 1 ")).toBe("Sprint 1");
  expect(name.safeParse("   ").success).toBe(false);
  expect(name.safeParse("x".repeat(101)).success).toBe(false);
  expect(rowSchemas.Cycle.shape.startDate.safeParse("2026-02-30").success).toBe(false);
  expect(rowSchemas.Module.shape.targetDate.safeParse(null).success).toBe(true);
});

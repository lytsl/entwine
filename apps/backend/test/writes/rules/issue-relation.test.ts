import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { allRows, createIssue, createProject, type Fixture, fixture, insert, remove } from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("relations", () => {
  const relate = (issueId: string, relatedId: string, type = "blocks", id = [issueId, relatedId].sort().join(":")) =>
    insert("IssueRelation", { id, issueId, relatedId, type });

  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
    await f.send([createIssue("a", "p1"), createIssue("b", "p1"), createIssue("x", "p2")]);
  });

  test("any two issues relate once, across projects, and each side records it", async () => {
    expect((await f.send([relate("a", "x")], "cy")).status).toBe(200);
    expect((await f.send([relate("x", "a", "relates_to")])).status).toBe(409);
    expect((await f.send([relate("a", "a")])).status).toBe(400);
    expect((await f.send([relate("a", "b", "blocks", "b:a")])).status).toBe(400);
    expect((await f.send([relate("a", "b", "depends")])).status).toBe(400);
    expect((await f.send([relate("a", "missing")])).status).toBe(404);
    const after = await rows();
    expect(after.IssueRelation).toMatchObject([{ id: "a:x", issueId: "a", relatedId: "x", type: "blocks" }]);
    const logged = after.Activity.filter((a) => a.field === "relation").map((a) => [a.issueId, a.newValue]);
    expect(logged.sort()).toEqual([
      ["a", "blocks:x"],
      ["x", "blocked_by:a"],
    ]);
  });

  test("a relation's type changes by removing it and adding another in one transaction", async () => {
    await f.send([relate("a", "b")]);
    expect((await f.send([remove("IssueRelation", "a:b"), relate("b", "a", "duplicate")])).status).toBe(200);
    expect((await rows()).IssueRelation).toMatchObject([{ issueId: "b", relatedId: "a", type: "duplicate" }]);
  });

  test("deleting an issue removes its relations, and the other issue records it", async () => {
    await f.send([relate("a", "b"), relate("x", "a", "relates_to")]);
    await f.send([remove("Issue", "a")]);
    const after = await rows();
    expect(after.IssueRelation).toEqual([]);
    const removed = after.Activity.filter((a) => a.field === "relation" && a.newValue === null);
    expect(removed.map((a) => [a.issueId, a.oldValue]).sort()).toEqual([
      ["b", "blocked_by:a"],
      ["x", "relates_to:a"],
    ]);
  });
});

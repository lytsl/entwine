import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  allRows,
  createIssue,
  createProject,
  type Fixture,
  fixture,
  insert,
  remove,
  update,
} from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("comments", () => {
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send([createIssue("i1", "p1")]);
    await f.send([insert("Comment", { id: "c1", issueId: "i1", body: "hello", authorId: "cy" })], "bob");
  });

  test("the author is the sender, and blank comments are refused", async () => {
    expect((await rows()).Comment[0]).toMatchObject({ authorId: "bob", editedAt: null });
    expect((await f.send([insert("Comment", { id: "c2", issueId: "i1", body: "   " })])).status).toBe(400);
  });

  test("only the author edits; the author or an admin deletes", async () => {
    expect((await f.send([update("Comment", "c1", { body: "hijacked" })], "ada")).status).toBe(403);
    await f.send([update("Comment", "c1", { body: "edited" })], "bob");
    expect((await rows()).Comment[0]).toMatchObject({ body: "edited", editedAt: expect.any(Number) });
    expect((await f.send([remove("Comment", "c1")], "cy")).status).toBe(403);
    expect((await f.send([remove("Comment", "c1")], "ada")).status).toBe(200);
  });
});

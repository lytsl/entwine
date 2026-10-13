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

describe("links", () => {
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send([createIssue("i1", "p1")]);
  });

  test("any member adds, edits and removes http links, which the server attributes", async () => {
    const link = { id: "k1", issueId: "i1", url: "https://example.com/spec", creatorId: "ada", createdAt: 1 };
    expect((await f.send([insert("IssueLink", { ...link, url: "ftp://example.com" })])).status).toBe(400);
    expect((await f.send([insert("IssueLink", link)], "cy")).status).toBe(200);
    expect((await rows()).IssueLink[0]).toMatchObject({ title: "", creatorId: "cy" });
    expect((await f.send([update("IssueLink", "k1", { title: "Spec", issueId: "other" })], "bob")).status).toBe(200);
    expect((await rows()).IssueLink[0]).toMatchObject({ title: "Spec", issueId: "i1" });
    expect((await f.send([update("IssueLink", "k1", { url: "notaurl" })])).status).toBe(400);
    expect((await f.send([remove("IssueLink", "k1")], "bob")).status).toBe(200);
    const logged = (await rows()).Activity.filter((a) => a.field === "link");
    expect(logged.map((a) => [a.oldValue, a.newValue])).toEqual([
      [null, "https://example.com/spec"],
      ["https://example.com/spec", null],
    ]);
  });

  test("deleting an issue removes its links", async () => {
    await f.send([insert("IssueLink", { id: "k1", issueId: "i1", url: "https://example.com" })]);
    await f.send([remove("Issue", "i1")]);
    expect((await rows()).IssueLink).toEqual([]);
  });
});

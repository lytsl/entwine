import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { allRows, createIssue, createProject, type Fixture, fixture, insert, remove } from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("labels", () => {
  test("names are unique ignoring case, and deleting unlinks issues", async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send([createIssue("i1", "p1"), insert("Label", { id: "l1", name: "Bug", color: "#ff0000" })]);
    expect((await f.send([insert("Label", { id: "l2", name: " bug ", color: "#00ff00" })])).status).toBe(409);
    expect((await f.send([insert("IssueLabel", { id: "wrong", issueId: "i1", labelId: "l1" })])).status).toBe(400);
    await f.send([insert("IssueLabel", { id: "i1:l1", issueId: "i1", labelId: "l1" })]);
    expect((await f.send([insert("IssueLabel", { id: "i1:l1", issueId: "i1", labelId: "l1" })])).status).toBe(409);
    await f.send([remove("Label", "l1")]);
    expect((await rows()).IssueLabel).toEqual([]);
  });
});

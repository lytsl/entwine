import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { allRows, createProject, type Fixture, fixture, insert, remove, update } from "../../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);

describe("views", () => {
  const query = (patch: object = {}) => JSON.stringify({ layout: "board", priorities: ["high"], ...patch });
  const view = (id: string, projectId: string | null = "p1") =>
    insert("View", { id, name: "Hot", projectId, query: query() });
  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
  });

  test("any member saves a view of a project or of all issues, which the server attributes", async () => {
    expect((await f.send([view("v1"), view("v2", null)], "cy")).status).toBe(200);
    expect((await rows()).View.map((v) => [v.id, v.projectId, v.creatorId])).toEqual([
      ["v1", "p1", "cy"],
      ["v2", null, "cy"],
    ]);
    expect((await f.send([view("v3", "missing")])).status).toBe(404);
  });

  test("the query must be a valid issue query, with no unknown keys", async () => {
    const bad = (json: string) => insert("View", { id: "v1", name: "Bad", projectId: null, query: json });
    for (const json of ["not json", query({ layout: "gantt" }), query({ secret: 1 }), "[]"])
      expect((await f.send([bad(json)])).status).toBe(400);
    expect((await f.send([bad("{}")])).status).toBe(200);
    expect((await f.send([insert("View", { id: "v2", name: " ", projectId: null, query: "{}" })])).status).toBe(400);
  });

  test("only its creator or an admin updates or deletes a view", async () => {
    await f.send([view("v1")], "cy");
    expect((await f.send([update("View", "v1", { name: "Mine" })], "bob")).status).toBe(403);
    expect((await f.send([remove("View", "v1")], "bob")).status).toBe(403);
    expect(
      (await f.send([update("View", "v1", { query: query({ group: "assignee" }), projectId: null })], "cy")).status,
    ).toBe(200);
    expect((await rows()).View[0]).toMatchObject({ projectId: "p1", query: query({ group: "assignee" }) });
    expect((await f.send([update("View", "v1", { query: "{" })], "cy")).status).toBe(400);
    expect((await f.send([update("View", "v1", { name: "Renamed" })], "bob", "admin")).status).toBe(200);
    expect((await f.send([remove("View", "v1")])).status).toBe(200);
    expect((await rows()).View).toEqual([]);
  });

  test("deleting a project deletes its views, and keeps the workspace's", async () => {
    await f.send([view("v1"), view("v2", null)]);
    await f.send([remove("Project", "p1")]);
    expect((await rows()).View.map((v) => v.id)).toEqual(["v2"]);
  });
});

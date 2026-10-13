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

describe("states", () => {
  const state = (id: string, name: string, group = "started", position = 9) =>
    insert("State", { id, projectId: "p1", name, color: "#ffffff", group, position });
  const statesOf = async (projectId = "p1") => (await rows()).State.filter((s) => s.projectId === projectId);

  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
  });

  test("any member adds a state with a name unique in the project, ignoring case", async () => {
    expect((await f.send([state("s1", "In Review")], "cy")).status).toBe(200);
    expect((await f.send([state("s2", " in review ")])).status).toBe(409);
    expect((await f.send([state("s3", "Done")])).status).toBe(409);
    expect((await f.send([insert("State", { ...state("s4", "In Review").value, projectId: "p2" })])).status).toBe(200);
    expect((await f.send([state("p1:other", "QA")])).status).toBe(400);
    expect((await statesOf()).map((s) => s.name)).toContain("In Review");
  });

  test("a state can be renamed, recolored, moved to another group and reordered, but keeps its project", async () => {
    await f.send([state("s1", "In Review")]);
    expect((await f.send([update("State", "s1", { name: "todo" })])).status).toBe(409);
    await f.send([
      update("State", "s1", { name: "Review", color: "#00ff00", group: "completed", position: 0, projectId: "p2" }),
    ]);
    expect((await statesOf()).find((s) => s.id === "s1")).toMatchObject({
      name: "Review",
      color: "#00ff00",
      group: "completed",
      position: 0,
      projectId: "p1",
    });
  });

  test("the default state, and a state issues use, cannot be deleted", async () => {
    await f.send([createIssue("i1", "p1", { stateId: "p1:started" })]);
    expect((await f.send([remove("State", "p1:backlog")])).status).toBe(400);
    expect((await f.send([remove("State", "p1:started")])).status).toBe(409);
    expect(await statesOf()).toHaveLength(5);
  });

  test("deleting a state after moving its issues, in one transaction, succeeds and records the move", async () => {
    await f.send([state("s1", "In Review")]);
    await f.send([createIssue("i1", "p1", { stateId: "s1" }), createIssue("i2", "p1", { stateId: "s1" })]);
    const move = await f.send([
      update("Issue", "i1", { stateId: "p1:started" }),
      update("Issue", "i2", { stateId: "p1:started" }),
      remove("State", "s1"),
    ]);
    expect(move.status).toBe(200);
    const after = await rows();
    expect(after.State.find((s) => s.id === "s1")).toBeUndefined();
    expect(after.Issue.map((i) => i.stateId)).toEqual(["p1:started", "p1:started"]);
    expect(after.Activity.filter((a) => a.field === "stateId").map((a) => [a.oldValue, a.newValue])).toEqual([
      ["s1", "p1:started"],
      ["s1", "p1:started"],
    ]);
  });
});

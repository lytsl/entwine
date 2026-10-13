import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { planCycles } from "../../src/services/cycle-schedule";
import { allRows, createIssue, createProject, type Fixture, fixture, insert, remove, update } from "../helpers/tenant";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
  await f.send(createProject("p1", "WEB"));
});
afterEach(() => f.cleanup());

const rows = () => allRows(f.tenant);
/** Noon UTC of an ISO date, or the instant given. */
const at = (when: string) => Date.parse(when.includes("T") ? when : `${when}T12:00:00Z`);
const plan = (when: string) => f.tenant.write((writer) => planCycles(writer, at(when)));
const schedule = (projectId: string, extra: Record<string, unknown> = {}) =>
  f.send([update("Project", projectId, { cycleWeeks: 2, ...extra })]);
const cycles = async (projectId = "p1") =>
  (await rows()).Cycle.filter((c) => c.projectId === projectId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((c) => [c.name, c.startDate, c.endDate]);
const manual = (id: string, name: string, startDate: string, endDate: string) =>
  insert("Cycle", { id, projectId: "p1", name, startDate, endDate });

describe("scheduled cycles", () => {
  test("a schedule's first cycles start on its weekday after today, back to back, with no creator", async () => {
    await schedule("p1");
    // A Wednesday.
    await plan("2026-10-14");
    expect(await cycles()).toEqual([
      ["Cycle 1", "2026-10-19", "2026-11-01"],
      ["Cycle 2", "2026-11-02", "2026-11-15"],
    ]);
    expect((await rows()).Cycle.map((c) => c.creatorId)).toEqual([null, null]);
  });

  test("when a cycle starts another is added, once", async () => {
    await schedule("p1");
    await plan("2026-10-14");
    await plan("2026-10-18");
    expect(await cycles()).toHaveLength(2);
    const before = (await f.tenant.log()).cursor;
    await plan("2026-10-19");
    expect((await cycles()).at(-1)).toEqual(["Cycle 3", "2026-11-16", "2026-11-29"]);
    await plan("2026-10-19T23:00:00Z");
    expect(await cycles()).toHaveLength(3);
    expect((await f.tenant.log()).cursor).toBe(before + 1);
  });

  test("a cycle that starts today is current, and the upcoming ones follow it", async () => {
    await schedule("p1", { cycleWeeks: 1, cycleStartDay: 3, cycleUpcoming: 1 });
    await plan("2026-10-14");
    expect(await cycles()).toEqual([
      ["Cycle 1", "2026-10-14", "2026-10-20"],
      ["Cycle 2", "2026-10-21", "2026-10-27"],
    ]);
  });

  test("today is the date in the schedule's time zone", async () => {
    await f.send(createProject("p2", "API"));
    await schedule("p1", { cycleWeeks: 1, cycleUpcoming: 1, cycleTimezone: "Asia/Kolkata" });
    await schedule("p2", { cycleWeeks: 1, cycleUpcoming: 1, cycleTimezone: "America/New_York" });
    // Monday the 19th in Kolkata, still Sunday the 18th in New York.
    await plan("2026-10-18T20:00:00Z");
    expect(await cycles("p1")).toEqual([
      ["Cycle 1", "2026-10-19", "2026-10-25"],
      ["Cycle 2", "2026-10-26", "2026-11-01"],
    ]);
    expect(await cycles("p2")).toEqual([["Cycle 1", "2026-10-19", "2026-10-25"]]);
  });

  test("hand-made cycles are left alone and stepped over, however far ahead; the number follows the highest", async () => {
    await f.send([
      manual("a", "Cycle 7", "2026-10-01", "2026-10-07"),
      manual("b", "Offsite", "2026-11-04", "2026-11-06"),
      manual("c", "Sprint 9", "2026-12-21", "2026-12-30"),
    ]);
    await schedule("p1", { cycleUpcoming: 3 });
    await plan("2026-10-14");
    expect(await cycles()).toEqual([
      ["Cycle 7", "2026-10-01", "2026-10-07"],
      ["Cycle 8", "2026-10-19", "2026-11-01"],
      ["Offsite", "2026-11-04", "2026-11-06"],
      ["Cycle 9", "2026-11-09", "2026-11-22"],
      ["Cycle 10", "2026-11-23", "2026-12-06"],
      ["Sprint 9", "2026-12-21", "2026-12-30"],
    ]);
    expect((await rows()).Cycle.find((c) => c.id === "c")).toMatchObject({ creatorId: "ada", name: "Sprint 9" });
  });

  test("a deleted upcoming cycle is replaced at the end; a changed schedule applies to new cycles", async () => {
    await schedule("p1");
    await plan("2026-10-14");
    const [first] = (await rows()).Cycle.filter((c) => c.name === "Cycle 1");
    expect((await f.send([remove("Cycle", first.id)], "bob")).status).toBe(403);
    expect((await f.send([remove("Cycle", first.id)], "ada")).status).toBe(200);
    await schedule("p1", { cycleWeeks: 1, cycleStartDay: 3 });
    await plan("2026-10-14");
    expect(await cycles()).toEqual([
      ["Cycle 2", "2026-11-02", "2026-11-15"],
      ["Cycle 3", "2026-11-18", "2026-11-24"],
    ]);
  });

  test("a project without a schedule, or an archived one, gets nothing", async () => {
    await f.send(createProject("p2", "API"));
    await f.send([manual("a", "Sprint 1", "2026-10-01", "2026-10-07"), createIssue("i1", "p1", { cycleId: "a" })]);
    await f.send([update("Project", "p2", { cycleWeeks: 2, cycleRollover: 1, archivedAt: 1 })]);
    const before = (await f.tenant.log()).cursor;
    await plan("2026-10-14");
    expect((await f.tenant.log()).cursor).toBe(before);
  });
});

describe("rollover", () => {
  const issue = (id: string, group: string, extra: Record<string, unknown> = {}) =>
    createIssue(id, "p1", { stateId: `p1:${group}`, cycleId: "a", ...extra });
  const cycleOf = async () => Object.fromEntries((await rows()).Issue.map((i) => [i.id, i.cycleId]));

  beforeEach(async () => {
    await f.send([
      manual("a", "Sprint 1", "2026-10-05", "2026-10-11"),
      manual("b", "Sprint 2", "2026-10-12", "2026-10-18"),
      manual("c", "Sprint 3", "2026-10-19", "2026-10-25"),
    ]);
    await f.send([
      issue("done", "completed"),
      issue("dropped", "cancelled"),
      issue("doing", "started", { estimate: 5 }),
    ]);
    await f.send([issue("later", "backlog"), issue("child", "unstarted", { parentId: "done" })]);
  });

  test("open issues of an ended cycle move to the current one, with activity that names no actor", async () => {
    await schedule("p1", { cycleRollover: 1, cycleUpcoming: 1 });
    await plan("2026-10-11");
    expect((await cycleOf()).doing).toBe("a");
    await plan("2026-10-12");
    expect(await cycleOf()).toEqual({ done: "a", dropped: "a", doing: "b", later: "b", child: "b" });
    const all = await rows();
    const moves = all.Activity.filter((a) => a.field === "cycleId" && a.oldValue === "a");
    expect(moves.map((a) => [a.issueId, a.newValue, a.actorId]).sort()).toEqual([
      ["child", "b", null],
      ["doing", "b", null],
      ["later", "b", null],
    ]);
    // The move is an edit of the issue, made at the time of the pass and not the test's own clock.
    expect(all.Issue.find((i) => i.id === "doing")!.updatedAt).toBe(at("2026-10-12"));
    // The ended cycle remembers what it did not finish: three issues, one of them estimated.
    expect(all.Cycle.find((c) => c.id === "a")).toMatchObject({ rolledIssues: 3, rolledPoints: 5 });
    expect(all.Cycle.find((c) => c.id === "b")).toMatchObject({ rolledIssues: 0, rolledPoints: 0 });
    const cursor = (await f.tenant.log()).cursor;
    await plan("2026-10-12T20:00:00Z");
    expect((await f.tenant.log()).cursor).toBe(cursor);
  });

  test("undoing the edit that set the schedule turns it off and keeps what the server did", async () => {
    await f.send(
      [update("Project", "p1", { cycleWeeks: 2, cycleRollover: 1, cycleUpcoming: 1 })],
      "ada",
      "owner",
      "tx",
    );
    await plan("2026-10-27");
    expect((await f.revert("tx")).status).toBe(200);
    const all = await rows();
    expect(all.Project[0]).toMatchObject({ cycleWeeks: null, cycleRollover: 0 });
    const added = all.Cycle.find((c) => c.name === "Cycle 1")!;
    expect((await cycleOf()).doing).toBe(added.id);
  });

  test("cycles missed while nobody used the workspace roll over together, and archived issues stay", async () => {
    await f.send([update("Issue", "later", { cycleId: "b" })]);
    await f.send([update("Issue", "child", { stateId: "p1:completed" })]);
    await f.send([update("Issue", "child", { archivedAt: 1 })]);
    // An archived issue's state stays writable, so it can be open.
    await f.send([update("Issue", "child", { stateId: "p1:started" })]);
    await schedule("p1", { cycleRollover: 1, cycleUpcoming: 1 });
    await plan("2026-10-20");
    expect(await cycleOf()).toEqual({ done: "a", dropped: "a", doing: "c", later: "c", child: "a" });
  });

  test("with no cycle left to run, they move to the first one the schedule adds", async () => {
    await schedule("p1", { cycleRollover: 1, cycleUpcoming: 1 });
    // A Tuesday, after every hand-made cycle.
    await plan("2026-10-27");
    const added = (await rows()).Cycle.find((c) => c.name === "Cycle 1")!;
    expect([added.startDate, added.creatorId]).toEqual(["2026-11-02", null]);
    expect((await cycleOf()).doing).toBe(added.id);
  });

  test("without the option nothing moves", async () => {
    await schedule("p1", { cycleUpcoming: 1 });
    await plan("2026-10-20");
    expect(new Set(Object.values(await cycleOf()))).toEqual(new Set(["a"]));
  });
});

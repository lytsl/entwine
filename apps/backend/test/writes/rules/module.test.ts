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

describe("modules", () => {
  const mod = (id: string, projectId = "p1", extra: Record<string, unknown> = {}) =>
    insert("Module", { id, projectId, name: `Module ${id}`, ...extra });
  const join = (issueId: string, moduleId: string, id = `${issueId}:${moduleId}`) =>
    insert("IssueModule", { id, issueId, moduleId });
  const activityOf = async (issueId: string) =>
    (await rows()).Activity.filter((a) => a.issueId === issueId && a.field === "module").map((a) => [
      a.oldValue,
      a.newValue,
    ]);

  beforeEach(async () => {
    await f.send(createProject("p1", "WEB"));
    await f.send(createProject("p2", "API"));
  });

  test("a new module has no dates and is in the backlog; dates and status are set later", async () => {
    expect((await f.send([mod("m1")], "cy")).status).toBe(200);
    expect((await rows()).Module[0]).toMatchObject({
      status: "backlog",
      startDate: null,
      targetDate: null,
      creatorId: "cy",
    });
    await f.send([
      update("Module", "m1", { status: "in_progress", startDate: "2026-10-01", targetDate: "2026-11-01" }),
    ]);
    expect((await rows()).Module[0]).toMatchObject({ status: "in_progress", targetDate: "2026-11-01" });
  });

  test("an unknown status, or a start after the target, is refused", async () => {
    await f.send([mod("m1", "p1", { startDate: "2026-10-01" })]);
    expect((await f.send([update("Module", "m1", { status: "shipping" })])).status).toBe(400);
    expect((await f.send([update("Module", "m1", { targetDate: "2026-09-30" })])).status).toBe(400);
    expect((await f.send([mod("m2", "p1", { startDate: "2026-10-02", targetDate: "2026-10-01" })])).status).toBe(400);
    expect((await rows()).Module).toMatchObject([{ id: "m1", status: "backlog", targetDate: null }]);
  });

  test("an issue is in several modules of its own project, once in each, and each change is activity", async () => {
    await f.send([mod("a"), mod("b"), mod("x", "p2"), createIssue("i1", "p1")]);
    expect((await f.send([join("i1", "a")], "bob")).status).toBe(200);
    expect((await f.send([join("i1", "b")], "bob")).status).toBe(200);
    expect((await f.send([join("i1", "a")])).status).toBe(409);
    expect((await f.send([join("i1", "x")])).status).toBe(400);
    expect((await f.send([join("i1", "b", "wrong")])).status).toBe(400);
    expect((await f.send([remove("IssueModule", "i1:a")], "cy")).status).toBe(200);
    expect((await rows()).IssueModule.map((m) => m.id)).toEqual(["i1:b"]);
    expect(await activityOf("i1")).toEqual([
      [null, "a"],
      [null, "b"],
      ["a", null],
    ]);
  });

  test("a refused membership refuses the whole transaction", async () => {
    await f.send([mod("a"), mod("x", "p2")]);
    expect((await f.send([createIssue("i1", "p1"), join("i1", "a"), join("i1", "x")])).status).toBe(400);
    expect([(await rows()).Issue, (await rows()).IssueModule]).toEqual([[], []]);
  });

  test("its creator or an admin deletes it; its issues stay, in their other modules, and say so", async () => {
    await f.send([mod("a"), mod("b"), createIssue("i1", "p1"), join("i1", "a"), join("i1", "b")], "cy");
    expect((await f.send([remove("Module", "a")], "bob")).status).toBe(403);
    expect((await f.send([remove("Module", "a")], "ada")).status).toBe(200);
    const after = await rows();
    expect(after.Module.map((m) => m.id)).toEqual(["b"]);
    expect(after.Issue).toHaveLength(1);
    expect(after.IssueModule.map((m) => m.id)).toEqual(["i1:b"]);
    expect((await activityOf("i1")).at(-1)).toEqual(["a", null]);
  });

  test("an archived project refuses new modules, edits and memberships, but its modules can be deleted", async () => {
    await f.send([mod("a"), mod("b"), createIssue("i1", "p1"), join("i1", "a")]);
    await f.send([update("Project", "p1", { archivedAt: 1 })]);
    expect((await f.send([mod("c")])).status).toBe(400);
    expect((await f.send([update("Module", "a", { status: "paused" })])).status).toBe(400);
    expect((await f.send([join("i1", "b")])).status).toBe(400);
    expect((await f.send([remove("IssueModule", "i1:a")])).status).toBe(400);
    expect((await f.send([remove("Module", "a")])).status).toBe(200);
    expect((await rows()).IssueModule).toEqual([]);
  });

  describe("lead and members", () => {
    const member = (moduleId: string, memberId: string, id = `${moduleId}:${memberId}`) =>
      insert("ModuleMember", { id, moduleId, memberId });
    const leave = (userId: string) =>
      f.tenant.write(async (writer) => {
        await writer.update("Member", userId, { removed: 1 });
      });
    const people = async () => {
      const all = await rows();
      return [all.Module.find((m) => m.id === "a")?.leadId, all.ModuleMember.map((m) => m.memberId).sort()];
    };

    beforeEach(async () => {
      await f.send([mod("a")]);
    });

    test("any member sets and clears the lead and adds and removes members; the lead need not be one", async () => {
      expect(await people()).toEqual([null, []]);
      expect((await f.send([update("Module", "a", { leadId: "bob" }), member("a", "cy")], "cy")).status).toBe(200);
      expect(await people()).toEqual(["bob", ["cy"]]);
      expect((await f.send([mod("b", "p1", { leadId: "cy" }), member("b", "cy")], "bob")).status).toBe(200);
      expect(
        (await f.send([update("Module", "a", { leadId: null }), remove("ModuleMember", "a:cy")], "bob")).status,
      ).toBe(200);
      expect(await people()).toEqual([null, ["cy"]]);
    });

    test("someone unknown or removed is refused, as is a member twice or a made-up id", async () => {
      await f.send([member("a", "cy")]);
      await leave("bob");
      expect((await f.send([update("Module", "a", { leadId: "nobody" })])).status).toBe(400);
      expect((await f.send([update("Module", "a", { name: "Renamed", leadId: "bob" })])).status).toBe(400);
      expect((await f.send([mod("b", "p1", { leadId: "bob" })])).status).toBe(400);
      expect((await f.send([member("a", "nobody")])).status).toBe(400);
      expect((await f.send([member("a", "bob")])).status).toBe(400);
      expect((await f.send([member("a", "cy")])).status).toBe(409);
      expect((await f.send([member("a", "ada", "other")])).status).toBe(400);
      expect((await f.send([member("missing", "ada")])).status).toBe(404);
      expect((await f.send([update("ModuleMember", "a:cy", { memberId: "ada" })])).status).toBe(403);
      expect(await people()).toEqual([null, ["cy"]]);
      expect((await rows()).Module[0].name).toBe("Module a");
    });

    test("a lead and a member who leave the workspace stay named, and can be taken off", async () => {
      await f.send([update("Module", "a", { leadId: "bob" }), member("a", "bob"), member("a", "cy")]);
      await leave("bob");
      expect(await people()).toEqual(["bob", ["bob", "cy"]]);
      // Other edits go through beside the lead who left.
      expect((await f.send([update("Module", "a", { status: "paused" })], "cy")).status).toBe(200);
      expect(
        (await f.send([update("Module", "a", { leadId: null }), remove("ModuleMember", "a:bob")], "cy")).status,
      ).toBe(200);
      expect(await people()).toEqual([null, ["cy"]]);
    });

    test("an archived project refuses them; deleting the module or its project removes its member list", async () => {
      await f.send([mod("x", "p2"), member("a", "bob"), member("x", "cy")]);
      await f.send([update("Project", "p1", { archivedAt: 1 })]);
      expect((await f.send([update("Module", "a", { leadId: "cy" })])).status).toBe(400);
      expect((await f.send([member("a", "cy")])).status).toBe(400);
      expect((await f.send([remove("ModuleMember", "a:bob")])).status).toBe(400);
      expect((await f.send([remove("Module", "a")], "ada", "owner", "gone")).status).toBe(200);
      expect((await rows()).ModuleMember.map((m) => m.id)).toEqual(["x:cy"]);
      await f.send([update("Project", "p1", { archivedAt: null })]);
      expect((await f.revert("gone")).status).toBe(200);
      expect((await rows()).ModuleMember.map((m) => m.id).sort()).toEqual(["a:bob", "x:cy"]);
      expect((await f.send([remove("Project", "p2")])).status).toBe(200);
      expect((await rows()).ModuleMember.map((m) => m.id)).toEqual(["a:bob"]);
    });
  });

  test("deleting an issue or a project removes its memberships and modules", async () => {
    await f.send([mod("a"), mod("x", "p2"), createIssue("i1", "p1"), createIssue("i2", "p1")]);
    await f.send([join("i1", "a"), join("i2", "a")]);
    await f.send([remove("Issue", "i1")]);
    expect((await rows()).IssueModule.map((m) => m.id)).toEqual(["i2:a"]);
    await f.send([remove("Project", "p1")]);
    const after = await rows();
    expect([after.IssueModule, after.Module.map((m) => m.id)]).toEqual([[], ["x"]]);
  });
});

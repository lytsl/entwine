import { afterEach, beforeEach, expect, test } from "bun:test";
import { SyncError } from "@entwine/db-collection";
import { pairId, progress, type Rows, type StateGroup } from "@entwine/shared";
import type { Client } from "./helpers/client";
import { eventually } from "./helpers/eventually";
import { createIssue, createProject, now } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let bob: Session;
let workspaceId: string;
/** The server's clock for cycle schedules: a Wednesday, until a test moves it. */
let clock: number;
beforeEach(async () => {
  clock = Date.parse("2026-10-14T12:00:00Z");
  h = await harness({ heartbeatMs: 20, now: () => clock });
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
});
afterEach(() => h.cleanup());

const cycle = (client: Client, id: string, projectId: string, creatorId: string) =>
  client.collections.Cycle.insert({
    id,
    projectId,
    name: `Cycle ${id}`,
    description: "",
    startDate: "2026-10-01",
    endDate: "2026-10-14",
    creatorId,
    rolledIssues: 0,
    rolledPoints: 0,
    createdAt: now,
    updatedAt: now,
  });

const module = (client: Client, id: string, projectId: string, creatorId: string) =>
  client.collections.Module.insert({
    id,
    projectId,
    name: `Module ${id}`,
    description: "",
    status: "backlog",
    startDate: null,
    targetDate: null,
    leadId: null,
    creatorId,
    createdAt: now,
    updatedAt: now,
  });

const join = (client: Client, issueId: string, moduleId: string) =>
  client.collections.IssueModule.insert({ id: pairId(issueId, moduleId), issueId, moduleId });

const setCycle = (client: Client, issueId: string, cycleId: string | null) =>
  client.mutate(() =>
    client.collections.Issue.update(issueId, (issue) => {
      issue.cycleId = cycleId;
    }),
  );

const progressOf = (client: Client, issueIds: string[]) =>
  progress(
    issueIds.map((id) => client.collections.Issue.get(id)!),
    (issue) => client.collections.State.get(issue.stateId)?.group as StateGroup,
  );

async function setup(): Promise<[Client, Client]> {
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId);
  await createProject(a, "p1", "WEB");
  await createIssue(a, "i1", "p1", ada.userId);
  await createIssue(a, "i2", "p1", ada.userId);
  await eventually(() => expect(b.collections.Issue.size).toBe(2));
  return [a, b];
}

test("plans and memberships made together reach every client, and progress follows state changes", async () => {
  const [a, b] = await setup();
  await a.mutate(() => {
    cycle(a, "c1", "p1", ada.userId);
    module(a, "m1", "p1", ada.userId);
    module(a, "m2", "p1", ada.userId);
    a.collections.Issue.update("i1", (issue) => {
      issue.cycleId = "c1";
    });
    join(a, "i1", "m1");
    join(a, "i1", "m2");
    join(a, "i2", "m1");
  });
  await eventually(() => {
    expect(b.collections.Issue.get("i1")?.cycleId).toBe("c1");
    expect(b.collections.IssueModule.toArray.map((m) => m.id).sort()).toEqual(["i1:m1", "i1:m2", "i2:m1"]);
  });
  expect(b.collections.Cycle.get("c1")?.creatorId).toBe(ada.userId);

  // An issue shared by two modules counts in both, and neither module's status moves with it.
  await b.mutate(() =>
    b.collections.Issue.update("i1", (issue) => {
      issue.stateId = "p1:completed";
    }),
  );
  await eventually(() => {
    expect(progressOf(a, ["i1", "i2"])).toMatchObject({ done: 1, planned: 2 });
    expect(progressOf(a, ["i1"])).toMatchObject({ done: 1, planned: 1 });
  });
  expect(a.collections.Module.toArray.map((m) => m.status)).toEqual(["backlog", "backlog"]);
});

test("moving an issue to another cycle replaces its cycle and records it for every member", async () => {
  const [a, b] = await setup();
  await a.mutate(() => {
    cycle(a, "ca", "p1", ada.userId);
    cycle(a, "cb", "p1", ada.userId);
  });
  await setCycle(a, "i1", "ca");
  await setCycle(b, "i1", "cb");
  await eventually(() => {
    expect(a.collections.Issue.get("i1")?.cycleId).toBe("cb");
    const logged = a.collections.Activity.toArray
      .filter((x) => x.issueId === "i1" && x.field === "cycleId")
      .sort((x, y) => x.createdAt - y.createdAt || (x.oldValue === null ? -1 : 1));
    expect(logged.map((x) => [x.oldValue, x.newValue, x.actorId])).toEqual([
      [null, "ca", ada.userId],
      ["ca", "cb", bob.userId],
    ]);
  });
});

test("an assignment to another project's cycle rolls back and says why", async () => {
  const [a, b] = await setup();
  await createProject(a, "p2", "API");
  await a.mutate(() => {
    cycle(a, "c1", "p1", ada.userId);
    cycle(a, "x", "p2", ada.userId);
  });
  await setCycle(a, "i1", "c1");
  await eventually(() => expect(b.collections.Cycle.get("x")).toBeDefined());
  const moving = setCycle(b, "i1", "x");
  expect(b.collections.Issue.get("i1")?.cycleId).toBe("x");
  const error = await moving.catch((e) => e);
  expect(error).toBeInstanceOf(SyncError);
  expect(error.code).toBe("invalid");
  expect(b.collections.Issue.get("i1")?.cycleId).toBe("c1");
});

test("deleting a cycle or module keeps its issues and every client drops the plan and its memberships", async () => {
  const [a, b] = await setup();
  await a.mutate(() => {
    cycle(a, "c1", "p1", ada.userId);
    module(a, "ma", "p1", ada.userId);
    module(a, "mb", "p1", ada.userId);
    a.collections.Issue.update("i1", (issue) => {
      issue.cycleId = "c1";
    });
    join(a, "i1", "ma");
    join(a, "i1", "mb");
  });
  await eventually(() => expect(b.collections.IssueModule.size).toBe(2));
  await a.mutate(() => {
    a.collections.Cycle.delete("c1");
    a.collections.Module.delete("ma");
  });
  await eventually(() => {
    expect(b.collections.Cycle.size).toBe(0);
    expect(b.collections.Module.toArray.map((m) => m.id)).toEqual(["mb"]);
    expect(b.collections.Issue.get("i1")?.cycleId).toBeNull();
    expect(b.collections.IssueModule.toArray.map((m) => m.id)).toEqual(["i1:mb"]);
  });
  const removed = b.collections.Activity.toArray.filter(
    (x) => x.issueId === "i1" && x.oldValue !== null && x.newValue === null,
  );
  expect(removed.map((x) => [x.field, x.oldValue]).sort()).toEqual([
    ["cycleId", "c1"],
    ["module", "ma"],
  ]);
  // Deleting the issue takes its remaining membership with it.
  await a.mutate(() => a.collections.Issue.delete("i1"));
  await eventually(() => expect(b.collections.IssueModule.size).toBe(0));
});

test("a member cannot delete another member's cycle, and the cycle comes back", async () => {
  const [a, b] = await setup();
  await a.mutate(() => cycle(a, "c1", "p1", ada.userId));
  await eventually(() => expect(b.collections.Cycle.get("c1")).toBeDefined());
  const deleting = b.mutate(() => b.collections.Cycle.delete("c1"));
  expect(b.collections.Cycle.get("c1")).toBeUndefined();
  const error = await deleting.catch((e) => e);
  expect(error.code).toBe("forbidden");
  expect(b.collections.Cycle.get("c1")?.name).toBe("Cycle c1");
});

const schedule = (client: Client, patch: Partial<Rows["Project"]>) =>
  client.mutate(() => client.collections.Project.update("p1", (project) => Object.assign(project, patch)));

test("a saved schedule's cycles reach every client; undoing the edit turns it off and keeps them", async () => {
  const [a, b] = await setup();
  await schedule(a, { cycleWeeks: 2 });
  await eventually(() =>
    expect(b.collections.Cycle.toArray.map((c) => [c.name, c.startDate, c.creatorId]).sort()).toEqual([
      ["Cycle 1", "2026-10-19", null],
      ["Cycle 2", "2026-11-02", null],
    ]),
  );
  await a.workspace.history.undo();
  await eventually(() => expect(b.collections.Project.get("p1")?.cycleWeeks).toBeNull());
  expect(a.collections.Cycle.size).toBe(2);
  expect(a.workspace.history.canUndo).toBe(true);
  // What is left to undo is the member's own earlier edit, not the server's cycles.
  await a.workspace.history.undo();
  await eventually(() => expect(b.collections.Issue.has("i2")).toBe(false));
  expect(b.collections.Cycle.size).toBe(2);
});

test("clients left open receive a rollover when the date changes, with activity that names no actor", async () => {
  const [a, b] = await setup();
  // Ends on the day the clock starts at.
  await a.mutate(() => cycle(a, "c1", "p1", ada.userId));
  await setCycle(a, "i1", "c1");
  await schedule(a, { cycleWeeks: 1, cycleUpcoming: 1, cycleRollover: 1 });
  await eventually(() => expect(b.collections.Cycle.size).toBe(2));
  const next = b.collections.Cycle.toArray.find((c) => c.name === "Cycle 1")!;
  expect(b.collections.Issue.get("i1")?.cycleId).toBe("c1");
  // Nobody asks for anything: the streams' heartbeats see the day turn.
  clock = Date.parse("2026-10-15T00:00:05Z");
  await eventually(() => {
    for (const client of [a, b]) {
      expect(client.collections.Issue.get("i1")?.cycleId).toBe(next.id);
      const moved = client.collections.Activity.toArray.filter((x) => x.oldValue === "c1");
      expect(moved.map((x) => [x.issueId, x.newValue, x.actorId])).toEqual([["i1", next.id, null]]);
    }
  });
});

test("a module's lead and members reach every client and go with the module", async () => {
  const [a, b] = await setup();
  await a.mutate(() => {
    module(a, "m1", "p1", ada.userId);
    a.collections.Module.update("m1", (m) => {
      m.leadId = bob.userId;
    });
    a.collections.ModuleMember.insert({ id: pairId("m1", ada.userId), moduleId: "m1", memberId: ada.userId });
  });
  await eventually(() => {
    expect(b.collections.Module.get("m1")?.leadId).toBe(bob.userId);
    expect(b.collections.ModuleMember.toArray.map((m) => m.memberId)).toEqual([ada.userId]);
  });
  const adding = b.mutate(() =>
    b.collections.ModuleMember.insert({ id: pairId("m1", "nobody"), moduleId: "m1", memberId: "nobody" }),
  );
  expect((await adding.catch((e) => e)).code).toBe("invalid");
  expect(b.collections.ModuleMember.size).toBe(1);
  await a.mutate(() => a.collections.Module.delete("m1"));
  await eventually(() => expect(b.collections.ModuleMember.size).toBe(0));
});

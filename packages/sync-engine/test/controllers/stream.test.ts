import { afterEach, beforeEach, expect, test } from "bun:test";
import { type Change, readEvents, type ServerEvent, type StreamOptions, stream } from "../../src";
import { type Fixture, fixture } from "../helpers/fixture";
import { memo, note } from "../helpers/toy";

let f: Fixture;
let epoch: string;
beforeEach(async () => {
  f = await fixture();
  epoch = (await f.tenant.log()).epoch;
});
afterEach(() => f.cleanup());

const open = (options: Partial<StreamOptions> = {}) =>
  stream(f.tenants, f.tenant, { reader: "ada", epoch, after: 0, signal: new AbortController().signal, ...options });

/** Reads events until `until` holds for what has arrived, or the stream ends; then lets go of the stream. */
async function read(response: Response, until: (events: ServerEvent[]) => boolean = () => false) {
  const events: ServerEvent[] = [];
  let error: unknown;
  try {
    for await (const event of readEvents(response.body!)) {
      events.push(event);
      if (until(events)) break;
    }
  } catch (e) {
    error = e;
  }
  await response.body!.cancel().catch(() => {});
  return { events, error };
}

const ids = (events: ServerEvent[]) =>
  events.filter((e) => e.event === "changes").flatMap((e) => (JSON.parse(e.data) as Change[]).map((c) => c.id));

const addNotes = async (names: string[]) => {
  for (const name of names) await f.tenant.write((w) => w.insert("Note", note(name)));
};

test("sends the backlog after the cursor, then live commits, each id once", async () => {
  const controller = new AbortController();
  const response = open({ after: 2, signal: controller.signal });
  // A commit racing the catch-up: it may arrive both from the log and from the subscription.
  const racing = f.tenant.write((w) => w.insert("Note", note("n3")));
  const events = read(response, (e) => ids(e).includes(6));
  await racing;
  await f.tenant.write((w) => w.insert("Note", note("n4")));
  expect(ids((await events).events)).toEqual([3, 4, 5, 6]);
  controller.abort();
});

test("the SSE id is the last change id of the event, and the wire keeps the log's private fields out", async () => {
  await f.tenant.write((w) => w.update("Note", "n1", { done: 1 }), { txid: "tx", actorId: "ada" });
  const { events } = await read(open({ after: 4 }), (e) => e.length > 0);
  expect(events[0]).toMatchObject({ event: "changes", id: "5" });
  expect(JSON.parse(events[0].data)).toEqual([
    { id: 5, model: "Note", rowId: "n1", data: { ...note("n1"), done: 1 }, inserted: false },
  ]);
});

test("a revoking change ends the stream with a revoked event", async () => {
  const response = open({ after: 4, revoked: (c) => c.model === "Note" && c.rowId === "n2" && c.data === null });
  const events = read(response);
  await f.tenant.write((w) => w.update("Note", "n1", { done: 1 }));
  await f.tenant.write((w) => w.delete("Note", "n2"));
  await f.tenant.write((w) => w.update("Note", "n1", { done: 0 }));
  expect((await events).events.map((e) => e.event)).toEqual(["changes", "changes", "revoked"]);
});

test("deleting the tenant ends its streams with a revoked event", async () => {
  const live = read(open({ after: 4 }));
  await f.tenant.write((w) => w.update("Note", "n1", { done: 1 }));
  // One that is still reading its backlog.
  const behind = read(open({ after: 0 }));
  await f.tenants.delete("t1");
  for (const { events, error } of await Promise.all([live, behind])) {
    expect(events.at(-1)?.event).toBe("revoked");
    expect(error).toBeUndefined();
  }
});

test("a position from another epoch, or ahead of the log, is answered with reset", async () => {
  for (const options of [{ epoch: "other" }, { epoch: null }, { after: 5 }]) {
    const { events } = await read(open(options));
    expect(events.map((e) => e.event)).toEqual(["reset"]);
  }
});

test("the stream closes at the heartbeat after its check fails", async () => {
  let allowed = true;
  const events = read(open({ after: 4, heartbeatMs: 10, check: async () => allowed }));
  await addNotes(["n3"]);
  allowed = false;
  const { events: received, error } = await events;
  expect(error).toBeUndefined();
  expect(ids(received)).toEqual([5]);
});

test("cancelling a stream waits for its running session check", async () => {
  let started!: () => void;
  const checking = new Promise<void>((resolve) => {
    started = resolve;
  });
  let release!: () => void;
  const held = new Promise<boolean>((resolve) => {
    release = () => resolve(true);
  });
  const response = open({
    after: 4,
    heartbeatMs: 1,
    check: () => {
      started();
      return held;
    },
  });
  await checking;
  let cancelled = false;
  const cancellation = response.body!.cancel().then(() => {
    cancelled = true;
  });
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(cancelled).toBe(false);
  } finally {
    release();
    await cancellation;
  }
  expect(cancelled).toBe(true);
});

test("a reader that falls behind is dropped, and resumes from its cursor exactly once", async () => {
  const slow = open({ after: 4, maxBufferedBytes: 1000 });
  await addNotes(Array.from({ length: 20 }, (_, i) => `m${i}`));
  const first = await read(slow);
  expect(first.error).toBeInstanceOf(Error);
  const cursor = Math.max(4, ...ids(first.events));
  const second = await read(open({ after: cursor }), (e) => ids(e).includes(24));
  expect([...ids(first.events), ...ids(second.events)]).toEqual(Array.from({ length: 20 }, (_, i) => 5 + i));
});

test("a change to a row with an owner goes to its owner's streams only, live and from the log", async () => {
  const seen = (events: ServerEvent[]) =>
    events.filter((e) => e.event === "changes").map((e) => [Number(e.id), ...(JSON.parse(e.data) as Change[])]);
  const live = read(open({ after: 4 }), (e) => e.length === 4);
  await f.tenant.write((w) => w.insert("Memo", memo("a1", "ada")));
  await f.tenant.write(async (w) => {
    await w.insert("Note", note("n3"));
    await w.insert("Memo", memo("b1", "bob"));
  });
  await f.tenant.write((w) => w.update("Memo", "a1", { text: "edited" }));
  await f.tenant.write((w) => w.delete("Memo", "a1"));
  const ada = seen((await live).events);
  // Every commit moves the position, also one whose last change is someone else's.
  expect(ada.map(([id, ...changes]) => [id, ...(changes as Change[]).map((c) => `${c.model}:${c.rowId}`)])).toEqual([
    [5, "Memo:a1"],
    [7, "Note:n3"],
    [8, "Memo:a1"],
    [9, "Memo:a1"],
  ]);
  expect((ada[3][1] as Change).data).toBeNull();

  await f.tenant.write((w) => w.insert("Note", note("n4")));
  const bob = seen((await read(open({ after: 4, reader: "bob" }), (e) => ids(e).includes(10))).events);
  expect(bob.flatMap(([, ...changes]) => (changes as Change[]).map((c) => `${c.id}:${c.model}:${c.rowId}`))).toEqual([
    "6:Note:n3",
    "7:Memo:b1",
    "10:Note:n4",
  ]);
  expect(JSON.stringify(bob)).not.toContain("a1");
});

test("a reader who may see nothing of the log still reaches its end", async () => {
  for (let i = 0; i < 5; i++) await f.tenant.write((w) => w.insert("Memo", memo(`b${i}`, "bob")));
  const { events } = await read(open({ after: 4 }), (e) => e.some((event) => event.id === "9"));
  expect(events.map((e) => [e.event, e.id, e.data])).toEqual([["changes", "9", "[]"]]);
});

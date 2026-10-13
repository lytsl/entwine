import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readEvents, stream } from "../../src";
import { type Fixture, fixture } from "../helpers/fixture";
import { note } from "../helpers/toy";

describe("pruning", () => {
  let small: Fixture;
  beforeEach(async () => {
    small = await fixture({ retentionMs: 0 });
  });
  afterEach(() => small.cleanup());

  const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

  test("a reopened tenant deletes the changes past the retention but the newest, and ids continue", async () => {
    await settle();
    await small.tenant.close();
    const reopened = await small.tenants.tenant("t1");
    expect(await reopened.changesAfter(0)).toBeNull();
    expect(await reopened.changesAfter(2)).toBeNull();
    expect((await reopened.changesAfter(3))!.map((c) => c.id)).toEqual([4]);
    await reopened.write((w) => w.insert("Note", note("n3")));
    expect((await reopened.log()).cursor).toBe(5);
  });

  test("an open tenant prunes after a write once the interval has passed", async () => {
    await settle();
    await small.tenant.write((w) => w.insert("Note", note("n3")));
    await settle();
    await small.tenant.write((w) => w.insert("Note", note("n4")));
    expect(await small.tenant.changesAfter(4)).toBeNull();
    expect((await small.tenant.changesAfter(5))!.map((c) => c.id)).toEqual([6]);
  });

  test("a stream from a position older than the kept changes is reset", async () => {
    await settle();
    await small.tenant.close();
    const reopened = await small.tenants.tenant("t1");
    const { epoch } = await reopened.log();
    const events = [];
    const signal = new AbortController().signal;
    const response = stream(small.tenants, reopened, { reader: "ada", epoch, after: 1, signal });
    for await (const event of readEvents(response.body!)) events.push(event.event);
    expect(events).toEqual(["reset"]);
  });

  test("a pruned transaction, including its retained tail, is no longer offered for undoing", async () => {
    await small.tenant.write((w) => w.insert("Note", note("n3")), { txid: "old" });
    await settle();
    await small.tenant.write(async (w) => expect(await w.changesOf("old")).toEqual([]));
  });
});

test("pruning drops the expired changes and keeps the ones after them", async () => {
  const some = await fixture({ retentionMs: 1000 });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  await some.tenant.write((w) => w.insert("Note", note("n3")));
  await some.tenant.close();
  const reopened = await some.tenants.tenant("t1");
  expect(await reopened.changesAfter(3)).toBeNull();
  expect((await reopened.changesAfter(4))!.map((c) => c.id)).toEqual([5]);
  await some.cleanup();
});

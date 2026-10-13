import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTenants } from "../../src";
import { collect, type Fixture, fixture } from "../helpers/fixture";
import { note, schema } from "../helpers/toy";

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
});
afterEach(() => f.cleanup());

test("a transaction id is applied once; a repeat answers its cursor and runs nothing", async () => {
  const insert = (w: Parameters<Parameters<typeof f.tenant.write>[0]>[0]) => w.insert("Note", note("n3"));
  expect(await f.tenant.write(insert, { txid: "tx" })).toEqual({ result: undefined, cursor: 5 });
  await f.tenant.write((w) => w.insert("Note", note("n4")));
  expect(await f.tenant.write(insert, { txid: "tx" })).toEqual({ cursor: 5 });
});

test("concurrent writes run one at a time, with ids in commit order", async () => {
  const sub = collect(f.tenants);
  await Promise.all(["a", "b", "c", "d"].map((id) => f.tenant.write((w) => w.insert("Note", note(id)))));
  expect(sub.changes.flat().map((c) => c.id)).toEqual([5, 6, 7, 8]);
});

test("tenants are isolated files, and a reopened tenant keeps its cursor", async () => {
  const other = await f.tenants.tenant("t2");
  expect((await other.load([{ model: "List" }])).rows.List).toEqual([]);
  await f.tenant.close();
  expect((await (await f.tenants.tenant("t1")).log()).cursor).toBe(4);
});

test("tenant ids that are not safe file names are refused", async () => {
  await expect(f.tenants.tenant("../evil")).rejects.toThrow("Invalid tenant id");
});

test("a tenant's epoch is created with its file, kept when it reopens and differs between tenants", async () => {
  const { epoch } = await f.tenant.log();
  await f.tenant.close();
  expect((await (await f.tenants.tenant("t1")).log()).epoch).toBe(epoch);
  expect((await (await f.tenants.tenant("t2")).log()).epoch).not.toBe(epoch);
});

test("a file without the engine's tables is refused, and not cached as broken", async () => {
  let ready = false;
  const tenants = createTenants({
    dir: mkdtempSync(join(tmpdir(), "entwine-engine-")),
    schema,
    prepare: async (path) => {
      if (ready) {
        const { prepare } = await import("../helpers/toy");
        await prepare(path);
      }
    },
  });
  await expect(tenants.tenant("t1")).rejects.toThrow("lacks the engine's change and epoch tables");
  ready = true;
  expect((await (await tenants.tenant("t1")).log()).cursor).toBe(0);
  await tenants.close();
});

test("handles held across evictions keep working, with consecutive ids in commit order", async () => {
  const small = await fixture({ maxOpen: 1 });
  try {
    const t1 = small.tenant;
    const t2 = await small.tenants.tenant("t2");
    await t2.write((w) => w.insert("List", { id: "l1", name: "One" }));
    const subs = [collect(small.tenants, "t1"), collect(small.tenants, "t2")];
    // Every call to one tenant evicts the other, while jobs of both are still queued.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 ? t2 : t1).write((w) => w.insert("Note", note(`m${i}`)))),
    );
    expect(subs[0].changes.flat().map((c) => c.id)).toEqual(Array.from({ length: 10 }, (_, i) => 5 + i));
    expect(subs[1].changes.flat().map((c) => c.id)).toEqual(Array.from({ length: 10 }, (_, i) => 2 + i));
    expect((await t1.changesAfter(0))!.map((c) => c.id)).toEqual(Array.from({ length: 14 }, (_, i) => 1 + i));
  } finally {
    await small.cleanup();
  }
});

test("a deleted tenant's files are removed once its queued jobs finish, and it is refused from then on", async () => {
  const other = await f.tenants.tenant("t2");
  await other.write((w) => w.insert("List", { id: "l1", name: "One" }));
  const sub = collect(f.tenants);
  let told = 0;
  f.tenants.subscribe("t1", () => {}, { deleted: () => told++ });
  // A write that is running and one that waits behind it: both were queued before the deletion.
  const running = f.tenant.write(async (w) => {
    for (let i = 0; i < 600; i++) await w.insert("Note", note(`bulk${i}`));
  });
  const waiting = f.tenant.write((w) => w.insert("Note", note("n3")));
  const deleted = f.tenants.delete("t1");
  // Asked after the deletion, through a handle given out before it.
  const late = f.tenant.write((w) => w.insert("Note", note("n4")));
  await expect(late).rejects.toMatchObject({ code: "forbidden" });
  await Promise.all([running, waiting, deleted]);
  expect(sub.changes.flat().length).toBe(601);
  expect(told).toBe(1);
  expect(readdirSync(f.dir).filter((name) => name.startsWith("t1."))).toEqual([]);

  await expect(f.tenant.load([{ model: "List" }])).rejects.toMatchObject({ code: "forbidden" });
  await expect(f.tenants.tenant("t1")).rejects.toMatchObject({ code: "forbidden" });
  expect(readdirSync(f.dir).filter((name) => name.startsWith("t1."))).toEqual([]);
  expect((await other.load([{ model: "List" }])).rows.List.length).toBe(1);
});

test("a tenant that is closed, or was never opened, is deleted too", async () => {
  await f.tenant.close();
  await f.tenants.delete("t1");
  await f.tenants.delete("never");
  expect(readdirSync(f.dir)).toEqual([]);
  await expect(f.tenants.delete("../evil")).rejects.toThrow("Invalid tenant id");
});

test("a long write of one tenant gives the others their turn", async () => {
  const other = await f.tenants.tenant("t2");
  const done: string[] = [];
  const long = f.tenant
    .write(async (w) => {
      for (let i = 0; i < 2000; i++) await w.insert("Note", note(`bulk${i}`));
    })
    .then(() => done.push("long"));
  const short = other.load([{ model: "List" }]).then(() => done.push("short"));
  await Promise.all([long, short]);
  expect(done).toEqual(["short", "long"]);
  // The tenant's own readers still wait for the whole write.
  expect((await f.tenant.load([{ model: "Note" }])).rows.Note.length).toBe(2002);
});

import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Row } from "@entwine/shared";
import { createIssue, createProject, type Fixture, fixture, insert, remove, update } from "../../helpers/tenant";

const A = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a10";
const B = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a11";
const bytes = (text: string) => new TextEncoder().encode(text);

let f: Fixture;
beforeEach(async () => {
  f = await fixture();
  await f.send(createProject("p1", "WEB"));
  await f.send([createIssue("i1", "p1")]);
  await f.files.save(A, bytes("hello"), "bob");
});
afterEach(() => f.cleanup());

const attachments = async () =>
  ((await f.tenant.load([{ model: "Attachment", where: { issueId: "i1" } }])).rows.Attachment ??
    []) as unknown as Row<"Attachment">[];
const attach = (id: string, extra: Record<string, unknown> = {}) =>
  insert("Attachment", { id, issueId: "i1", name: "notes.txt", ...extra });

test("the server sets the uploader and the stored file's size", async () => {
  expect((await f.send([attach(A, { size: 9_999, uploaderId: "cy" })], "bob")).status).toBe(200);
  expect(await attachments()).toEqual([
    { id: A, issueId: "i1", name: "notes.txt", size: 5, uploaderId: "bob", createdAt: expect.any(Number) },
  ]);
});

test("an attachment needs its file, a name, a UUID and an issue that is not archived", async () => {
  expect((await f.send([attach(B)], "bob")).status).toBe(400);
  expect((await f.send([attach(A, { name: "  " })], "bob")).status).toBe(400);
  expect((await f.send([attach("../t1.db")], "bob")).status).toBe(400);
  // On a disk that ignores case this would be a second row for the same file.
  expect((await f.send([attach(A.toUpperCase())], "bob")).status).toBe(400);
  // A name is shown to other members and names their download: no path, control or direction-changing characters.
  for (const name of ["../../notes.txt", "a\\b.txt", "a\r\nSet-Cookie: x.txt", "photo\u202egnp.exe"])
    expect((await f.send([attach(A, { name })], "bob")).status).toBe(400);
  expect((await f.send([attach(A, { issueId: "gone" })], "bob")).status).toBe(404);
  await f.send([update("Issue", "i1", { stateId: "p1:completed" })]);
  await f.send([update("Issue", "i1", { archivedAt: 1 })]);
  expect((await f.send([attach(A)], "bob")).status).toBe(400);
  expect(await attachments()).toEqual([]);
});

test("its uploader or an admin removes an attachment, and nobody edits one", async () => {
  await f.send([attach(A)], "bob");
  expect((await f.send([remove("Attachment", A)], "cy")).status).toBe(403);
  expect((await f.send([update("Attachment", A, { name: "other.txt" })], "bob")).status).toBe(403);
  expect((await f.send([remove("Attachment", A)], "ada", "owner")).status).toBe(200);
  expect(await attachments()).toEqual([]);
  await f.send([attach(A)], "bob");
  expect((await f.send([remove("Attachment", A)], "bob")).status).toBe(200);
});

test("a removal is undone while the file is stored, and refused once it is gone", async () => {
  await f.send([attach(A)], "bob");
  const [row] = await attachments();
  await f.send([remove("Attachment", A)], "bob", "member", "remove");
  // The file outlives its row.
  expect(await f.files.size(A)).toBe(5);
  expect((await f.revert("remove", "undo", "bob")).status).toBe(200);
  expect(await attachments()).toEqual([row]);

  await f.send([remove("Attachment", A)], "bob", "member", "again");
  await f.files.sweep(new Set(), Date.now() + 1000);
  expect(await f.files.uploader(A)).toBeNull();
  expect((await f.revert("again", "undo-again", "bob")).status).toBe(409);
  expect(await attachments()).toEqual([]);
});

test("only the member who uploaded a file attaches it, also while a removed attachment's file is kept", async () => {
  expect((await f.send([attach(A)], "cy")).status).toBe(403);
  expect((await f.send([attach(A)], "ada", "owner")).status).toBe(403);
  await f.send([attach(A)], "bob");
  await f.send([remove("Attachment", A)], "bob");
  expect((await f.send([attach(A, { name: "mine.txt" })], "cy")).status).toBe(403);
  expect(await attachments()).toEqual([]);
});

test("a deleted issue takes its attachments with it, in the change log, and its undo restores them", async () => {
  await f.send([attach(A)], "bob");
  const before = await attachments();
  const { cursor } = await f.tenant.log();
  expect((await f.send([remove("Issue", "i1")], "ada", "owner", "delete")).status).toBe(200);
  expect(await attachments()).toEqual([]);
  const deleted = (await f.tenant.changesAfter(cursor))!.filter((c) => c.model === "Attachment");
  expect(deleted.map((c) => [c.rowId, c.data])).toEqual([[A, null]]);
  expect((await f.revert("delete")).status).toBe(200);
  expect(await attachments()).toEqual(before);
});

import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insert, loadAll, send } from "../helpers/requests";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
let tenantDir: string;
beforeEach(async () => {
  tenantDir = mkdtempSync(join(tmpdir(), "entwine-tenants-"));
  t = await testServer({ tenantDir });
});
afterEach(async () => {
  await t.cleanup();
  rmSync(tenantDir, { recursive: true, force: true });
});

const remove = (account: Account, organizationId: string) =>
  account.fetch("/api/auth/organization/delete", { method: "POST", body: JSON.stringify({ organizationId }) });
const files = (id: string) => readdirSync(tenantDir).filter((name) => name.startsWith(id));
const label = (id: string) => insert("Label", { id, name: id, color: "#112233" });

test("only the owner deletes a workspace: its members, invitations, file and attachments go, and its slug is free", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const cy = await t.signUp("cy");
  const dee = await t.signUp("dee");
  const id = await t.workspace(ada, "acme", [
    [bob, "admin"],
    [cy, "member"],
  ]);
  const other = await t.workspace(ada, "other", [[bob, "member"]]);
  const invitation = await ada.json<{ id: string }>("/api/auth/organization/invite-member", {
    email: dee.email,
    role: "member",
    organizationId: id,
  });
  expect((await send(bob, id, [label("l1")])).status).toBe(200);
  const upload = await bob.fetch(`/api/w/${id}/files/${crypto.randomUUID()}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new Uint8Array([1, 2, 3]),
  });
  expect(upload.status).toBe(201);
  expect(files(id)).toEqual(expect.arrayContaining([`${id}.db`, `${id}.files`]));

  for (const account of [bob, cy, dee]) expect((await remove(account, id)).ok).toBe(false);
  expect((await bob.fetch(`/api/w/${id}/load`, loadAll)).status).toBe(200);

  expect((await remove(ada, id)).status).toBe(200);
  expect(files(id)).toEqual([]);
  for (const account of [ada, bob]) {
    const list = await account.json<{ id: string }[]>("/api/auth/organization/list");
    expect(list.map((w) => w.id)).toEqual([other]);
    expect((await account.fetch(`/api/w/${id}/load`, loadAll)).status).toBe(403);
    expect((await send(account, id, [label("l2")])).status).toBe(403);
    expect((await account.fetch(`/api/w/${id}/stream`)).status).toBe(403);
  }
  const accepted = await dee.fetch("/api/auth/organization/accept-invitation", {
    method: "POST",
    body: JSON.stringify({ invitationId: invitation.id }),
  });
  expect(accepted.ok).toBe(false);
  // Refused requests opened nothing, and the other workspace is as it was.
  expect(files(id)).toEqual([]);
  expect((await bob.fetch(`/api/w/${other}/load`, loadAll)).status).toBe(200);

  // The slug names a new workspace, which holds nothing of the old one.
  const again = await t.workspace(bob, "acme");
  expect(again).not.toBe(id);
  const loaded = await bob.json<{ rows: { Label: unknown[] } }>(`/api/w/${again}/load`, {
    queries: [{ model: "Label" }],
  });
  expect(loaded.rows.Label).toEqual([]);
  expect((await cy.fetch(`/api/w/${again}/load`, loadAll)).status).toBe(403);
});

test("a workspace whose store is not open is deleted too", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  await (await t.server.tenants.tenant(id)).close();
  expect((await remove(ada, id)).status).toBe(200);
  expect(files(id)).toEqual([]);
  expect(await ada.json<unknown[]>("/api/auth/organization/list")).toEqual([]);
});

test("an upload still arriving when its workspace is deleted is refused, and leaves nothing on disk", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  // The body is asked for once the request has passed the access check, and given once the workspace is gone.
  const asked = Promise.withResolvers<void>();
  const gone = Promise.withResolvers<void>();
  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        asked.resolve();
        await gone.promise;
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const upload = ada.fetch(`/api/w/${id}/files/${crypto.randomUUID()}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body,
    duplex: "half",
  } as RequestInit);
  await asked.promise;
  expect((await remove(ada, id)).status).toBe(200);
  gone.resolve();
  expect((await upload).status).toBe(403);
  expect(files(id)).toEqual([]);
});

test("a deletion the server stopped in the middle of is finished at the next start, and only that one", async () => {
  const authPath = join(tenantDir, "auth.db");
  await t.cleanup();
  t = await testServer({ tenantDir, authPath });
  const ada = await t.signUp("ada");
  const kept = await t.workspace(ada, "kept");
  const half = await t.workspace(ada, "half");
  for (const id of [kept, half]) expect((await send(ada, id, [label("l1")])).status).toBe(200);
  // The auth database forgot one workspace and the server stopped; the other's deletion was marked and then refused.
  for (const id of [kept, half]) writeFileSync(join(tenantDir, `${id}.deleting`), "");
  const { database } = t.server.auth;
  for (const table of ["member", "invitation"]) database.run(`DELETE FROM ${table} WHERE "organizationId" = ?`, [half]);
  database.run("DELETE FROM organization WHERE id = ?", [half]);
  await t.cleanup();

  t = await testServer({ tenantDir, authPath });
  expect(files(half)).toEqual([]);
  expect(files(kept)).toEqual([`${kept}.db`]);
});

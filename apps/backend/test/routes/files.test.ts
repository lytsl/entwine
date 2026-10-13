import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ATTACHMENT_MAX_BYTES, attachmentPath, defaultStates } from "@entwine/shared";
import { insert, send } from "../helpers/requests";
import { type Account, testServer } from "../helpers/server";

const A = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a10";
const B = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a11";
const C = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a12";

let t: Awaited<ReturnType<typeof testServer>>;
let tenantDir: string;
let ada: Account;
let bob: Account;
let eve: Account;
let ws: string;
beforeEach(async () => {
  tenantDir = mkdtempSync(join(tmpdir(), "entwine-files-"));
  t = await testServer({ tenantDir });
  ada = await t.signUp("ada");
  bob = await t.signUp("bob");
  eve = await t.signUp("eve");
  ws = await t.workspace(ada, "acme", [[bob, "member"]]);
  await send(ada, ws, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
    insert("Issue", { id: "i1", projectId: "p1", title: "One", stateId: "p1:backlog" }),
  ]);
});
afterEach(async () => {
  await t.cleanup();
  rmSync(tenantDir, { recursive: true, force: true });
});

const upload = (
  account: Account,
  id: string,
  body: string | Uint8Array<ArrayBuffer>,
  workspaceId = ws,
  type?: string,
) =>
  account.fetch(attachmentPath(workspaceId, id), {
    method: "POST",
    body,
    headers: { "Content-Type": type ?? "application/octet-stream" },
  });
const attach = (account: Account, id: string, name: string) =>
  send(account, ws, [insert("Attachment", { id, issueId: "i1", name })]);
const stored = (id: string, workspaceId = ws) => join(tenantDir, `${workspaceId}.files`, id);

test("a file is uploaded, recorded, and then downloaded under its name by a member", async () => {
  expect((await ada.fetch(attachmentPath(ws, A))).status).toBe(404);
  const uploaded = await upload(ada, A, "hello");
  expect(uploaded.status).toBe(201);
  expect(await uploaded.json()).toEqual({ size: 5 });
  expect(existsSync(stored(A))).toBe(true);
  // Bytes without an attachment are not served.
  expect((await ada.fetch(attachmentPath(ws, A))).status).toBe(404);
  expect((await attach(ada, A, "notés (ada's).txt")).status).toBe(200);

  const file = await bob.fetch(attachmentPath(ws, A));
  expect(file.status).toBe(200);
  expect(await file.text()).toBe("hello");
  expect(file.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''not%C3%A9s%20%28ada%27s%29.txt");
  expect(file.headers.get("Content-Type")).toBe("application/octet-stream");

  expect((await send(ada, ws, [{ model: "Attachment", type: "delete", key: A, value: {} }])).status).toBe(200);
  expect((await bob.fetch(attachmentPath(ws, A))).status).toBe(404);
});

test("files need a session, membership and the app's origin, and stay in their workspace", async () => {
  await upload(ada, A, "hello");
  await attach(ada, A, "a.txt");
  const path = attachmentPath(ws, A);
  expect((await t.request(path)).status).toBe(401);
  expect((await eve.fetch(path)).status).toBe(403);
  expect((await t.request(attachmentPath(ws, B), { method: "POST", body: "x" })).status).toBe(401);
  expect((await upload(eve, B, "x")).status).toBe(403);
  const elsewhere = await t.server.app.fetch(
    new Request(`http://localhost:3000${attachmentPath(ws, B)}`, {
      method: "POST",
      body: "x",
      headers: { Origin: "https://evil.example", Cookie: ada.cookie, "Content-Type": "application/octet-stream" },
    }),
  );
  expect(elsewhere.status).toBe(403);
  expect(existsSync(stored(B))).toBe(false);

  const other = await t.workspace(eve, "other");
  expect((await eve.fetch(attachmentPath(other, A))).status).toBe(404);
  expect((await upload(eve, A, "mine", other)).status).toBe(201);
  expect(await (await ada.fetch(path)).text()).toBe("hello");
});

test("an upload is raw bytes under a UUID, not empty, at most 10 MB, and never replaces a file", async () => {
  expect((await upload(ada, A, "x", ws, "multipart/form-data")).status).toBe(415);
  expect((await upload(ada, A, "x", ws, "text/plain")).status).toBe(415);
  expect((await upload(ada, "notes.txt", "x")).status).toBe(400);
  expect((await upload(ada, A, "")).status).toBe(400);
  const large = await upload(ada, A, new Uint8Array(ATTACHMENT_MAX_BYTES + 1));
  expect(large.status).toBe(413);
  expect(await large.json()).toMatchObject({ code: "invalid" });
  expect(existsSync(stored(A))).toBe(false);
  expect((await upload(ada, A, new Uint8Array(ATTACHMENT_MAX_BYTES))).status).toBe(201);

  expect((await upload(ada, B, "first")).status).toBe(201);
  expect((await upload(bob, B, "second")).status).toBe(409);
  await attach(ada, B, "b.txt");
  expect(await (await ada.fetch(attachmentPath(ws, B))).text()).toBe("first");
});

test("only raster images are served as what they are; HTML and SVG are inert downloads", async () => {
  await upload(ada, A, "<script>alert(1)</script>");
  await attach(ada, A, "page.html");
  await upload(ada, B, "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>");
  await attach(ada, B, "logo.svg");
  await upload(ada, C, "png");
  await attach(ada, C, "shot.PNG");
  for (const id of [A, B]) {
    const file = await ada.fetch(attachmentPath(ws, id));
    expect(file.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(file.headers.get("Content-Disposition")).toStartWith("attachment;");
    expect(file.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(file.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
  }
  const image = await ada.fetch(attachmentPath(ws, C));
  expect(image.headers.get("Content-Type")).toBe("image/png");
  expect(image.headers.get("Content-Disposition")).toBe("inline; filename*=UTF-8''shot.PNG");
  expect(image.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(image.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
  expect(image.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
});

test("an upload deletes the files that have had no attachment for a day, and keeps the others", async () => {
  await upload(ada, A, "orphan");
  await upload(ada, B, "attached");
  await attach(ada, B, "b.txt");
  // No API makes a file old.
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
  utimesSync(stored(A), old, old);
  utimesSync(stored(B), old, old);
  expect((await upload(ada, C, "new")).status).toBe(201);
  expect([A, B, C].map((id) => existsSync(stored(id)))).toEqual([false, true, true]);

  // Removing the attachment starts the day: the next upload keeps its file, which an undo needs.
  await send(ada, ws, [{ model: "Attachment", type: "delete", key: B, value: {} }]);
  expect((await upload(ada, A, "again")).status).toBe(201);
  expect(existsSync(stored(B))).toBe(true);
});

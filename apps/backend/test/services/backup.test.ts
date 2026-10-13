import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { attachmentPath, defaultStates } from "@entwine/shared";
import { S3Client } from "bun";
import { backup, backupDue, backups, type DataPaths, restore } from "../../src/services/backup";
import { insert, send } from "../helpers/requests";
import { s3Sink } from "../helpers/s3-sink";
import { type Account, testServer } from "../helpers/server";
import { removeTemp } from "../helpers/temp";

const FILE = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a10";

let dir: string;
let paths: DataPaths;
let sink: ReturnType<typeof s3Sink>;
let store: S3Client;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "entwine-backup-"));
  paths = {
    authPath: join(dir, "data", "auth.db"),
    tenantDir: join(dir, "data", "tenants"),
  };
  sink = s3Sink();
  store = new S3Client({ endpoint: sink.endpoint, bucket: "b", accessKeyId: "key", secretAccessKey: "secret" });
});
afterEach(() => {
  setSystemTime();
  sink.stop();
  removeTemp(dir);
});

const label = (id: string) => insert("Label", { id, name: id, color: "#112233" });
const labels = async (fetch: Account["fetch"], workspaceId: string) => {
  const loaded = await fetch(`/api/w/${workspaceId}/load`, {
    method: "POST",
    body: JSON.stringify({ queries: [{ model: "Label" }] }),
  });
  return ((await loaded.json()) as { rows: { Label: { id: string }[] } }).rows.Label.map((row) => row.id);
};

test("a backup made beside a running server restores what it held, attachments and sessions too", async () => {
  let t = await testServer(paths);
  const ada = await t.signUp("ada");
  const ws = await t.workspace(ada, "acme");
  await send(ada, ws, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
    insert("Issue", { id: "i1", projectId: "p1", title: "One", stateId: "p1:backlog" }),
    label("before"),
  ]);
  const uploaded = await ada.fetch(attachmentPath(ws, FILE), {
    method: "POST",
    body: "hello",
    headers: { "Content-Type": "application/octet-stream" },
  });
  expect(uploaded.status).toBe(201);
  expect((await send(ada, ws, [insert("Attachment", { id: FILE, issueId: "i1", name: "a.txt" })])).status).toBe(200);

  const [name, during] = await Promise.all([backup(paths, store), send(ada, ws, [label("during")])]);
  expect(during.status).toBe(200);
  expect(await backups(store)).toEqual([name]);

  expect((await send(ada, ws, [label("after")])).status).toBe(200);
  await t.workspace(ada, "later");
  // Refused while the server runs, and for a name no backup has; neither changes anything.
  await expect(restore(paths, store, name)).rejects.toThrow("Another server is using");
  await expect(restore(paths, store, "2020-01-01T00-00-00.000Z")).rejects.toThrow("There is no backup");
  expect(await labels(ada.fetch, ws)).toContain("after");
  await t.cleanup();

  await restore(paths, store, name);
  t = await testServer(paths);
  // The session is the one signed up with; its requests go to the new server.
  const again = (path: string, init?: RequestInit) => t.request(path, init, ada.cookie);
  const listed = (await (await again("/api/auth/organization/list")).json()) as { slug: string }[];
  expect(listed.map((w) => w.slug)).toEqual(["acme"]);
  const restored = await labels(again, ws);
  expect(restored).toContain("before");
  expect(restored).not.toContain("after");
  expect(await (await again(attachmentPath(ws, FILE))).text()).toBe("hello");
  expect(await backups(store)).toEqual([name]);
  await t.cleanup();
});

test("the seven newest backups are kept, and one is due when the newest is a day old", async () => {
  mkdirSync(join(dir, "data"));
  writeFileSync(join(dir, "data", "push-keys.json"), "{}");
  expect(await backupDue(store)).toBe(true);
  const now = Date.now();
  const made: string[] = [];
  for (let n = 0; n < 8; n++) {
    setSystemTime(new Date(now + n * 1000));
    made.push(await backup(paths, store));
  }
  expect(await backups(store)).toEqual(made.slice(1));
  expect([...sink.objects.keys()]).toEqual(made.slice(1).map((name) => `backups/${name}.tar.gz`));

  setSystemTime(new Date(now + 23 * 60 * 60 * 1000));
  expect(await backupDue(store)).toBe(false);
  setSystemTime(new Date(now + 25 * 60 * 60 * 1000));
  expect(await backupDue(store)).toBe(true);
});

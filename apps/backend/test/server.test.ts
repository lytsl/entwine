import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_SECRET } from "../src/env";
import { createServer } from "../src/server";
import { removeTemp } from "./helpers/temp";

const SECRET = "test-secret-with-at-least-thirty-two-characters";
const { NODE_ENV, BETTER_AUTH_SECRET } = process.env;
let dir: string;
let paths: { authPath: string; tenantDir: string };
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "entwine-server-"));
  paths = { authPath: join(dir, "auth.db"), tenantDir: join(dir, "tenants") };
});
afterEach(() => {
  // Assigning undefined would set the string "undefined".
  for (const [name, value] of Object.entries({ NODE_ENV, BETTER_AUTH_SECRET }))
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  removeTemp(dir);
});

test("a production server refuses the development secret", async () => {
  process.env.NODE_ENV = "production";
  await expect(createServer({ secret: DEV_SECRET })).rejects.toThrow("Set BETTER_AUTH_SECRET");
});

test("a production server without a secret makes one and keeps it", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.BETTER_AUTH_SECRET;
  await (await createServer(paths)).close();
  const made = readFileSync(join(dir, "secret"), "utf8");
  expect(made.length).toBeGreaterThanOrEqual(32);
  expect(made).not.toBe(DEV_SECRET);
  await (await createServer(paths)).close();
  expect(readFileSync(join(dir, "secret"), "utf8")).toBe(made);
});

test("a second server on a data directory refuses to start until the first has stopped", async () => {
  const first = await createServer({ ...paths, secret: SECRET });
  await expect(createServer({ ...paths, secret: SECRET })).rejects.toThrow("Another server is using");
  expect((await first.app.request("/api/health")).status).toBe(200);
  await first.close();
  await (await createServer({ ...paths, secret: SECRET })).close();
});

import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testServer } from "../helpers/server";

const PAGE = '<!doctype html><div id="root"></div>';

let t: Awaited<ReturnType<typeof testServer>>;
let pagesDir: string;
beforeEach(async () => {
  pagesDir = mkdtempSync(join(tmpdir(), "entwine-pages-"));
  mkdirSync(join(pagesDir, "assets"));
  writeFileSync(join(pagesDir, "index.html"), PAGE);
  writeFileSync(join(pagesDir, "assets", "index-abc123.js"), "console.log(1)");
  t = await testServer({ pagesDir });
});
afterEach(async () => {
  await t.cleanup();
  rmSync(pagesDir, { recursive: true, force: true });
});

test("a route of the app answers its page, revalidated and not framed by another origin", async () => {
  const response = await t.request("/acme/issues");
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(PAGE);
  expect(response.headers.get("Cache-Control")).toBe("no-cache");
  expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
});

test("an asset is cached for good", async () => {
  const response = await t.request("/assets/index-abc123.js");
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("console.log(1)");
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
});

test("a missing asset or API path is not found", async () => {
  expect((await t.request("/assets/index-old.js")).status).toBe(404);
  expect((await t.request("/api/nothing")).status).toBe(404);
  expect((await t.request("/api/health")).status).toBe(200);
});

test("without a build the backend answers only the API", async () => {
  const bare = await testServer({ pagesDir: join(pagesDir, "missing") });
  try {
    expect((await bare.request("/acme/issues")).status).toBe(404);
    expect((await bare.request("/api/health")).status).toBe(200);
  } finally {
    await bare.cleanup();
  }
});

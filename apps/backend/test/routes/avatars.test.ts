import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AVATAR_MAX_BYTES } from "@entwine/shared";
import { type Account, testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
afterEach(() => t.cleanup());

/** A 1×1 transparent PNG. */
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

const upload = (account: Account, bytes: Uint8Array<ArrayBuffer>, type = "image/png") =>
  account.fetch("/api/avatar", { method: "PUT", headers: { "Content-Type": type }, body: bytes });

test("an uploaded picture becomes the account's avatar in every workspace, served to the signed in", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const id = await t.workspace(ada, "acme", [[bob, "member"]]);

  const response = await upload(ada, PNG);
  expect(response.status).toBe(200);
  const { image } = (await response.json()) as { image: string };
  expect(image).toMatch(/^\/api\/avatars\/[0-9a-f-]{36}\.png$/);

  const directory = await bob.json<{ rows: { Member: { id: string; image: string | null }[] } }>(`/api/w/${id}/load`, {
    queries: [{ model: "Member" }],
  });
  expect(directory.rows.Member.find((m) => m.id === ada.id)?.image).toBe(image);

  const served = await bob.fetch(image);
  expect(served.status).toBe(200);
  expect(served.headers.get("Content-Type")).toBe("image/png");
  expect(served.headers.get("Cache-Control")).toContain("immutable");
  expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
  expect((await t.request(image)).status).toBe(401);
});

test("a new picture replaces the old one's file, and removing it leaves the initials", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const avatars = join(t.server.auth.database.filename, "..", "avatars");
  const first = ((await (await upload(ada, PNG)).json()) as { image: string }).image;
  const second = ((await (await upload(ada, PNG)).json()) as { image: string }).image;
  expect(second).not.toBe(first);
  expect(existsSync(join(avatars, first.split("/").at(-1)!))).toBe(false);

  expect((await ada.fetch("/api/avatar", { method: "DELETE" })).status).toBe(200);
  expect(existsSync(join(avatars, second.split("/").at(-1)!))).toBe(false);
  const { user } = (await (await ada.fetch("/api/auth/get-session")).json()) as { user: { image: string | null } };
  expect(user.image).toBeNull();
});

test("only a PNG, JPEG or WebP image whose bytes match, of at most 512 KB, is accepted", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  expect((await upload(ada, PNG, "image/svg+xml")).status).toBe(415);
  expect((await upload(ada, new TextEncoder().encode("<svg onload=alert(1)>"), "image/png")).status).toBe(400);
  expect((await upload(ada, PNG, "image/jpeg")).status).toBe(400);
  const big = new Uint8Array(AVATAR_MAX_BYTES + 1);
  big.set(PNG);
  expect((await upload(ada, big)).status).toBe(413);
  const elsewhere = await t.server.app.fetch(
    new Request("http://localhost:3000/api/avatar", {
      method: "PUT",
      headers: { "Content-Type": "image/png", Origin: "https://evil.example", Cookie: ada.cookie },
      body: PNG,
    }),
  );
  expect(elsewhere.status).toBe(403);
});

test("an account's picture cannot be set to an address of the client's choosing", async () => {
  t = await testServer();
  const ada = await t.signUp("ada");
  const set = await ada.fetch("/api/auth/update-user", {
    method: "POST",
    body: JSON.stringify({ image: "https://evil.example/track.png" }),
  });
  expect(set.status).toBe(400);
  const signUp = await t.request("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({
      name: "Eve",
      email: "eve@example.com",
      password: "password123",
      image: "https://x.test/a.png",
    }),
  });
  expect(signUp.status).toBe(400);
});

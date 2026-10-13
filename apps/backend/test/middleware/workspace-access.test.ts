import { afterEach, beforeEach, expect, test } from "bun:test";
import { defaultStates } from "@entwine/shared";
import { insert, loadAll, send } from "../helpers/requests";
import { testServer } from "../helpers/server";

let t: Awaited<ReturnType<typeof testServer>>;
beforeEach(async () => {
  t = await testServer();
});
afterEach(() => t.cleanup());

const createIssue = (id: string) => insert("Issue", { id, projectId: "p1", title: id, stateId: "p1:backlog" });

test("a sync request that names another origin is refused", async () => {
  const ada = await t.signUp("ada");
  const id = await t.workspace(ada, "acme");
  const elsewhere = { ...loadAll, headers: { ...loadAll.headers, Origin: "http://evil.example" } };
  // The helper sets the app's own origin; a caller that overrides it does so after.
  const response = await t.server.app.fetch(
    new Request(`http://localhost:3000/api/w/${id}/load`, {
      ...elsewhere,
      headers: { ...elsewhere.headers, Cookie: ada.cookie },
    }),
  );
  expect(response.status).toBe(403);
  expect((await ada.fetch(`/api/w/${id}/load`, loadAll)).headers.get("X-Content-Type-Options")).toBe("nosniff");
});

test("a role change applies to the member's next write", async () => {
  const ada = await t.signUp("ada");
  const bob = await t.signUp("bob");
  const cy = await t.signUp("cy");
  const id = await t.workspace(ada, "acme", [
    [bob, "admin"],
    [cy, "member"],
  ]);
  await send(ada, id, [
    insert("Project", { id: "p1", name: "Web", identifier: "WEB", description: "" }),
    ...defaultStates("p1").map((state) => insert("State", state)),
  ]);
  await send(cy, id, [createIssue("i1"), createIssue("i2")]);
  expect((await send(bob, id, [{ model: "Issue", type: "delete", key: "i1", value: {} }])).status).toBe(200);

  const { members } = await ada.json<{ members: { id: string; userId: string }[] }>(
    `/api/auth/organization/get-full-organization?organizationId=${id}`,
  );
  await ada.json("/api/auth/organization/update-member-role", {
    memberId: members.find((m) => m.userId === bob.id)!.id,
    role: "member",
    organizationId: id,
  });
  expect((await send(bob, id, [{ model: "Issue", type: "delete", key: "i2", value: {} }])).status).toBe(403);
});

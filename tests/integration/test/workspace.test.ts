/** What the auth database decides of a workspace, as open clients come to know it: its name, and its deletion. */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { device } from "./helpers/device";
import { eventually } from "./helpers/eventually";
import { createProject } from "./helpers/fixtures";
import { harness, type Session } from "./helpers/harness";

let h: Awaited<ReturnType<typeof harness>>;
let ada: Session;
let bob: Session;
let workspaceId: string;
beforeEach(async () => {
  h = await harness({ heartbeatMs: 20 });
  ada = await h.signUp("ada");
  bob = await h.signUp("bob");
  workspaceId = await h.workspace(ada, "acme", [bob]);
});
afterEach(() => h.cleanup());

const stored = () => readdirSync(join(h.dir, "tenants")).filter((name) => name.startsWith(workspaceId));
const tables = (d: ReturnType<typeof device>) =>
  d.db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all();

test("a rename of the workspace, and of a member, reaches an open client", async () => {
  const b = await h.connect(bob, workspaceId);
  expect(b.collections.Workspace.get(workspaceId)?.name).toBe("acme");
  await h.post(
    "/api/auth/organization/update",
    { data: { name: "Acme Labs" }, organizationId: workspaceId },
    ada.cookie,
  );
  await eventually(() => expect(b.collections.Workspace.get(workspaceId)?.name).toBe("Acme Labs"));
  await h.post("/api/auth/update-user", { name: "Ada L." }, ada.cookie);
  await eventually(() => expect(b.collections.Member.get(ada.userId)?.name).toBe("Ada L."));
});

test("deleting the workspace revokes its open clients, which keep nothing of it", async () => {
  const phone = device();
  const a = await h.connect(ada, workspaceId);
  const b = await h.connect(bob, workspaceId, { device: phone });
  await createProject(b, "p1", "WEB");
  await h.post("/api/auth/organization/delete", { organizationId: workspaceId }, ada.cookie);
  await eventually(() => expect([a.workspace.status, b.workspace.status]).toEqual(["revoked", "revoked"]));
  await b.close();
  expect(tables(phone)).toEqual([]);
  expect(stored()).toEqual([]);
});

test("a write kept while the workspace was deleted is never applied, and its client keeps nothing", async () => {
  const phone = device();
  const b = await h.connect(bob, workspaceId, { device: phone });
  await eventually(() => expect(b.workspace.status).toBe("live"));
  b.faults.offline = true;
  b.faults.dropStream();
  const kept = createProject(b, "p1", "WEB").catch((error) => error);
  await eventually(() => expect(b.workspace.status).toBe("offline"));
  await h.post("/api/auth/organization/delete", { organizationId: workspaceId }, ada.cookie);
  expect(stored()).toEqual([]);

  b.faults.offline = false;
  await eventually(() => expect(b.workspace.status).toBe("revoked"), 5000);
  await b.close();
  expect(await kept).toBeInstanceOf(Error);
  expect(tables(phone)).toEqual([]);
  // Neither the stream nor the kept write opened a store for the workspace again.
  expect(stored()).toEqual([]);

  // The address is free; what opens under it is another workspace, and another store on the device.
  const again = await h.workspace(ada, "acme", [bob]);
  const fresh = await h.connect(bob, again, { device: device() });
  expect(fresh.collections.Project.size).toBe(0);
  expect(fresh.collections.Workspace.get(again)?.name).toBe("acme");
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Change, createTenants, type Tenant, type Tenants, type TenantsOptions } from "../../src";
import { note, prepare, schema, type Toy } from "./toy";

export interface Fixture {
  dir: string;
  tenants: Tenants<Toy>;
  tenant: Tenant<Toy>;
  cleanup(): Promise<void>;
}

/** A fresh tenant with lists l1 and l2 and notes n1 (in l1) and n2 (in l2): changes 1 to 4. */
export async function fixture(options: Partial<TenantsOptions<Toy>> = {}): Promise<Fixture> {
  const dir = mkdtempSync(join(tmpdir(), "entwine-engine-"));
  const tenants = createTenants({ dir, schema, prepare, ...options });
  const tenant = await tenants.tenant("t1");
  await tenant.write(async (w) => {
    await w.insert("List", { id: "l1", name: "One" });
    await w.insert("List", { id: "l2", name: "Two" });
    await w.insert("Note", note("n1"));
    await w.insert("Note", note("n2", "l2"));
  });
  return {
    dir,
    tenants,
    tenant,
    async cleanup() {
      await tenants.close();
      // Windows keeps a closed SQLite file locked until its statements are garbage-collected.
      Bun.gc(true);
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {}
    },
  };
}

export function collect(tenants: Tenants<Toy>, id = "t1"): { changes: Change[][]; stop(): void } {
  const changes: Change[][] = [];
  return { changes, stop: tenants.subscribe(id, (c) => changes.push(c)) };
}

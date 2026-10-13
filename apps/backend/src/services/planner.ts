/**
 * When a workspace's cycle schedules are carried out. There is no background job: a workspace is planned when it is
 * used, and again while it stays in use. The pass is a write of the tenant like any other, so every open client
 * receives what it did.
 */
import type { Rows } from "@entwine/shared";
import type { Tenants } from "@entwine/sync-engine";
import { planCycles } from "./cycle-schedule";

/** Every time zone's offset is a multiple of it, so no project's date changes inside one. */
const QUARTER_HOUR_MS = 15 * 60 * 1000;

export interface Planner {
  run(workspaceId: string): Promise<void>;
  /** Plans the workspace unless it was planned in this quarter hour: asked on every request and heartbeat. */
  visit(workspaceId: string): Promise<void>;
}

export function createPlanner(tenants: Tenants<Rows>, now: () => number = Date.now): Planner {
  /** The quarter hour each workspace was last planned in, since the process started. */
  const planned = new Map<string, number>();
  const run = async (workspaceId: string) => {
    const at = now();
    planned.set(workspaceId, Math.floor(at / QUARTER_HOUR_MS));
    try {
      const tenant = await tenants.tenant(workspaceId);
      await tenant.write((writer) => planCycles(writer, at));
    } catch (error) {
      // The request that came by is answered all the same; the next quarter hour tries again.
      console.error(`Planning the cycles of workspace ${workspaceId} failed`, error);
    }
  };
  return {
    run,
    async visit(workspaceId) {
      if (planned.get(workspaceId) !== Math.floor(now() / QUARTER_HOUR_MS)) await run(workspaceId);
    },
  };
}

import type { Row, Rows } from "@entwine/shared";
import { type Change, errorResponse, load, stream, type Tenants, transact } from "@entwine/sync-engine";
import { Hono } from "hono";
import { compress } from "hono/compress";
import type { Auth } from "../auth/create-auth";
import { maxBody } from "../middleware/body-limit";
import { rateLimit } from "../middleware/rate-limit";
import { sameOrigin } from "../middleware/same-origin";
import { workspaceAccess } from "../middleware/workspace-access";
import type { Delivery } from "../services/delivery/delivery";
import { workspaceFiles } from "../services/files";
import { createPlanner } from "../services/planner";
import { workspaceCaller } from "../services/workspace-caller";
import type { AppEnv } from "../types";
import { applyTransaction } from "../writes/transaction";
import { fileRoutes } from "./files";

export interface SyncOptions {
  /** The app's origin: a sync request that names another origin is refused. */
  origin: string;
  requestsPerMinute?: number;
  /** The sync stream's heartbeat, at which it also checks the session again. */
  heartbeatMs?: number;
  /** Where each workspace's attachment bytes are kept: the tenants' directory. */
  fileDir: string;
  /** The clock the cycle schedules are planned by; tests move it. */
  now?: () => number;
  /** Mails and pushes what a transaction notified. */
  delivery?: Delivery;
}

/** JSON only: a cross-site form cannot send it. */
const json = async (request: Request) =>
  request.headers.get("Content-Type")?.split(";")[0].trim() === "application/json"
    ? await request.json().catch(() => null)
    : undefined;

export function syncRoutes(auth: Auth, tenants: Tenants<Rows>, options: SyncOptions) {
  const routes = new Hono<AppEnv>().basePath("/:workspaceId");

  const planner = createPlanner(tenants, options.now);

  routes.use("/*", sameOrigin(options.origin), workspaceAccess(auth, tenants));
  // What a schedule owes since the workspace was last used is done before the request reads it.
  routes.use("/*", async (c, next) => {
    await planner.visit(c.req.param("workspaceId"));
    await next();
  });
  routes.on("POST", "/*", rateLimit(options.requestsPerMinute));

  routes.route("/files", fileRoutes(options.fileDir));

  const limit = maxBody(1024 * 1024);

  routes.post("/load", limit, compress(), async (c) => {
    const body = await json(c.req.raw);
    if (body === undefined) return errorResponse(415, "invalid", "Queries are sent as JSON");
    return load(c.var.tenant, body, c.var.userId);
  });

  routes.get("/stream", (c) => {
    const { userId } = c.var;
    const workspaceId = c.req.param("workspaceId");
    const after = Number(c.req.header("Last-Event-ID") ?? c.req.query("after") ?? 0);
    const revoked = (change: Change) =>
      change.model === "Member" &&
      change.rowId === userId &&
      (change.data as { removed?: number } | null)?.removed === 1;
    return stream(tenants, c.var.tenant, {
      reader: userId,
      epoch: c.req.query("epoch") ?? null,
      after: Number.isFinite(after) ? after : 0,
      signal: c.req.raw.signal,
      revoked,
      // A signed-out or removed member's stream ends; the client's reconnect is then refused.
      // An open stream also keeps the workspace planned: a tab left open sees a cycle roll over at midnight.
      check: async () => {
        if ((await workspaceCaller(auth, workspaceId, c.req.raw.headers))?.membership?.userId !== userId) return false;
        await planner.visit(workspaceId);
        return true;
      },
      heartbeatMs: options.heartbeatMs,
    });
  });

  routes.post("/transactions", limit, async (c) => {
    const body = await json(c.req.raw);
    if (body === undefined) return errorResponse(415, "invalid", "Changes are sent as JSON");
    const { tenant, userId, role } = c.var;
    let replan = false;
    const notified: Row<"Notification">[] = [];
    const response = await transact(tenant, body, userId, (writer, request) =>
      applyTransaction(
        {
          writer,
          userId,
          role,
          now: Date.now(),
          files: workspaceFiles(options.fileDir, tenant.id),
          replan: () => void (replan = true),
          notified: (row) => void notified.push(row),
        },
        request,
      ),
    );
    if (replan && response.ok) await planner.run(tenant.id);
    if (response.ok) options.delivery?.notified(tenant.id, notified);
    return response;
  });

  return routes;
}

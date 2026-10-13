import { errorResponse } from "@entwine/sync-engine";
import type { MiddlewareHandler } from "hono";

/**
 * The session cookie is SameSite=Lax and writes are JSON or binary, so a browser sends none of these for another
 * site; a request that says it comes from one is refused all the same.
 */
export const sameOrigin =
  (origin: string): MiddlewareHandler =>
  async (c, next) => {
    const from = c.req.header("Origin");
    if (from && from !== origin) return errorResponse(403, "forbidden", "This origin is not allowed");
    await next();
  };

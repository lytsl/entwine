import { errorResponse } from "@entwine/sync-engine";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

export function rateLimit(perMinute = 500): MiddlewareHandler<AppEnv> {
  /** Each member's requests in the current minute. Entries are never dropped: at most one per account. */
  const asked = new Map<string, { since: number; count: number }>();
  return async (c, next) => {
    const now = Date.now();
    let window = asked.get(c.var.userId);
    if (!window || now - window.since >= 60_000) asked.set(c.var.userId, (window = { since: now, count: 0 }));
    window.count++;
    const left = Math.max(0, perMinute - window.count);
    const headers = {
      "X-RateLimit-Requests-Limit": String(perMinute),
      "X-RateLimit-Requests-Remaining": String(left),
      "X-RateLimit-Requests-Reset": String(window.since + 60_000),
    };
    if (window.count > perMinute) {
      const response = errorResponse(429, "failed", "Too many requests; they continue in a moment");
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      response.headers.set("Retry-After", String(Math.ceil((window.since + 60_000 - now) / 1000)));
      return response;
    }
    await next();
    for (const [name, value] of Object.entries(headers)) c.header(name, value);
  };
}

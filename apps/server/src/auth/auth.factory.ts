import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { dbManager } from "@/db/db-manager";
import mainSchema from "@/db/schema-main";
import type { THonoPrivateEnv } from "@/routes/types";
import type { auth } from "./better-auth";
import type { BunWebSocketData } from "hono/bun";

export const authGuard = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.body(null, 401);
  }
  // c.req.valid("header");
  await next();
});

export function createAuthApp() {
  return new Hono<{
    Variables: typeof auth.$Infer.Session;
    Bindings: {
      server: Bun.Server<BunWebSocketData>;
    };
  }>().use("*", async (c, next) => {
    const user = c.get("user");
    if (!user) {
      console.log("session", c.get("session"));
      return c.body(null, 401);
    }

    await next();
  });
}

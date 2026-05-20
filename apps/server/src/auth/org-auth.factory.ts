import type { NonNullableFields } from "@entwine/utility/types";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Hono } from "hono";
import type { BunWebSocketData } from "hono/bun";
import { createMiddleware } from "hono/factory";
import type { auth } from "./better-auth";

export const authGuard = createMiddleware(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.body(null, 401);
  }
  // c.req.valid("header");
  await next();
});

export const orgHeaderSchema = z.object({
  "x-organization-slug": z.string().default("linear"),
});

export function createOrgApp() {
  return new Hono<{
    Variables: NonNullableFields<typeof auth.$Infer.Session>;
    Bindings: {
      server: Bun.Server<BunWebSocketData>;
    };
  }>()
    .use("*", zValidator("header", orgHeaderSchema))
    .use("*", async (c, next) => {
      const user = c.get("user");
      if (!user) {
        console.log("session", c.get("session"));
        return c.body(null, 401);
      }

      const headers = c.req.valid("header");
      const organization = c.get("organization");
      if (!organization) {
        console.log("organization", headers);
        return c.body(null, 401);
      }

      await next();
    });
}

import { Hono } from "hono";
import type { Auth } from "../auth/create-auth";
import { maxBody } from "../middleware/body-limit";
import { clientIp } from "../middleware/client-ip";
import type { AppEnv } from "../types";

export function authRoutes(auth: Auth, clientIpHeader?: string) {
  const routes = new Hono<AppEnv>();
  // An account request is a few fields; without a bound a profile could hold megabytes for every member to load.
  routes.on(["GET", "POST"], "/*", maxBody(64 * 1024), clientIp(clientIpHeader), (c) => auth.auth.handler(c.req.raw));
  return routes;
}

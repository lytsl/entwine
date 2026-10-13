import { errorResponse } from "@entwine/sync-engine";
import { Hono } from "hono";
import type { Auth } from "../auth/create-auth";
import type { AppEnv } from "../types";

/**
 * Asked without a session, so that an invitation's link can lead to sign-up or sign-in. The id is the link's
 * secret: only its holder learns whether the address it was sent to has an account.
 */
export function invitationRoutes(auth: Auth) {
  const routes = new Hono<AppEnv>();
  routes.get("/:id", (c) => {
    const invitee = auth.invitee(c.req.param("id"));
    return invitee ? c.json(invitee) : errorResponse(404, "not_found", "There is no such invitation");
  });
  return routes;
}

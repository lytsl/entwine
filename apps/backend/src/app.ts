import type { AppConfig, Rows } from "@entwine/shared";
import { errorResponse, type Tenants, WriteError } from "@entwine/sync-engine";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { Auth } from "./auth/create-auth";
import { authRoutes } from "./routes/auth";
import { avatarRoutes } from "./routes/avatars";
import { invitationRoutes } from "./routes/invitations";
import { pageRoutes } from "./routes/pages";
import { type SyncOptions, syncRoutes } from "./routes/sync";
import type { AvatarStore } from "./services/avatars";
import type { AppEnv } from "./types";

export interface AppOptions extends SyncOptions {
  /** The header in which a reverse proxy gives the client's address; without it the address is the connection's. */
  clientIpHeader?: string;
  pagesDir: string;
  avatars: AvatarStore;
  config: AppConfig;
}

export function createApp(auth: Auth, tenants: Tenants<Rows>, options: AppOptions) {
  const app = new Hono<AppEnv>();

  app.onError((error) => {
    // A workspace deleted while its request was being served refuses it.
    if (error instanceof WriteError && error.code === "forbidden")
      return errorResponse(403, "forbidden", error.message);
    console.error(error);
    return errorResponse(500, "failed", "Something went wrong on the server");
  });

  app.use(secureHeaders());

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/config", (c) => c.json(options.config));
  app.route("/api/auth", authRoutes(auth, options.clientIpHeader));
  app.route("/api/invitations", invitationRoutes(auth));
  app.route("/api", avatarRoutes(auth, options.avatars, options.origin));
  app.route("/api/w", syncRoutes(auth, tenants, options));
  app.route("/", pageRoutes(options.pagesDir));

  return app;
}

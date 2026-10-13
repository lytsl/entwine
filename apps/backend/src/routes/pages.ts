import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { AppEnv } from "../types";

/**
 * The built frontend, mounted after the API; without a build there are none. Vite names each asset by a hash of
 * its content, so an asset never changes; the page names the current assets, so a browser revalidates it.
 */
export function pageRoutes(dir: string) {
  const routes = new Hono<AppEnv>();
  const index = join(dir, "index.html");
  if (!existsSync(index)) return routes;
  // Read once: a new build is deployed by restarting.
  const page = readFileSync(index, "utf8");

  routes.use(
    "/assets/*",
    serveStatic({
      root: dir,
      onFound: (_, c) => c.header("Cache-Control", "public, max-age=31536000, immutable"),
    }),
  );
  // The service worker that shows pushes, at the root it controls; revalidated, so a new build's reaches every browser.
  routes.get(
    "/push-worker.js",
    serveStatic({ path: join(dir, "push-worker.js"), onFound: (_, c) => c.header("Cache-Control", "no-cache") }),
  );
  routes.get("*", (c) => {
    if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/assets/")) return c.notFound();
    c.header("Cache-Control", "no-cache");
    return c.html(page);
  });

  return routes;
}

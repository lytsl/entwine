/** Stands in for `vite preview`, whose proxy target is fixed to :3001, which another process may hold. */
import { join } from "node:path";

const dist = join(import.meta.dir, "../../../apps/frontend/dist");
const backend = process.env.AUDIT_BACKEND ?? "http://localhost:4101";

Bun.serve({
  port: Number(process.env.PORT ?? 4100),
  idleTimeout: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return fetch(`${backend}${url.pathname}${url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "manual",
        // The backend compresses loads; the browser is the one to undo it.
        decompress: false,
        signal: request.signal,
      });
    }
    const file = Bun.file(join(dist, url.pathname));
    if (url.pathname !== "/" && (await file.exists())) return new Response(file);
    return new Response(Bun.file(join(dist, "index.html")));
  },
});
console.log("[audit] frontend on http://localhost:4100");

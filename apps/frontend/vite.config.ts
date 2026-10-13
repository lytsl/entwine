import { createHash } from "node:crypto";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig, type Plugin } from "vite";

/**
 * The content security policy, as a meta tag so that any static host serves it: scripts from the app and the one
 * inline script by its hash, WebAssembly for the device store, and no other origin. The development server injects
 * scripts of its own, so only the build gets it.
 */
const contentSecurityPolicy = (): Plugin => ({
  name: "entwine-csp",
  apply: "build",
  // After Vite's own changes to the page: the hash is of the inline script as it is served.
  transformIndexHtml: {
    order: "post",
    handler(html) {
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        ([, script]) => `'sha256-${createHash("sha256").update(script).digest("base64")}'`,
      );
      const policy = [
        "default-src 'self'",
        `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; ");
      return html.replace(
        "<head>",
        `<head>
    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  },
});

// `/api` (including the SSE stream) is proxied to the backend, so the app and the API share an origin.
const proxy = { "/api": `http://localhost:${process.env.BACKEND_PORT ?? 3001}` };

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), contentSecurityPolicy()],
  // Pre-bundling would move the persistence's OPFS worker away from its `new URL(…, import.meta.url)`.
  optimizeDeps: { exclude: ["@tanstack/browser-db-sqlite-persistence"] },
  server: { port: 3000, proxy },
  preview: { port: 3000, proxy },
});

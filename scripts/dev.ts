/**
 * The two apps are started from here because each needs the other's port: the frontend proxies `/api` to the
 * backend, and the backend only answers the frontend's origin.
 */
import { createServer } from "node:net";
import { join } from "node:path";

const APPS = join(import.meta.dir, "../apps");

const listens = (port: number, host: string) =>
  new Promise<boolean>((resolve) => {
    const server = createServer()
      .once("error", (error: NodeJS.ErrnoException) => resolve(error.code !== "EADDRINUSE"))
      .once("listening", () => server.close(() => resolve(true)))
      .listen(port, host);
  });

/**
 * Tries every address of this machine: a server on `::1` leaves `0.0.0.0` free. One at a time, since the probes
 * of `0.0.0.0` and `::` hold the port from each other.
 */
async function freePort(from: number, taken?: number): Promise<number> {
  next: for (let port = from; port < 65536; port++) {
    if (port === taken) continue;
    for (const host of ["0.0.0.0", "127.0.0.1", "::", "::1"]) if (!(await listens(port, host))) continue next;
    return port;
  }
  throw new Error(`No free port from ${from}`);
}

const backend = await freePort(3001);
const frontend = await freePort(3000, backend);

const run = (app: string, args: string[], env: Record<string, string>) =>
  Bun.spawn(["bun", "run", "dev", ...args], {
    cwd: join(APPS, app),
    env: { ...process.env, ...env },
    stdio: ["inherit", "inherit", "inherit"],
  });
const apps = [
  run("backend", [], { PORT: String(backend), BETTER_AUTH_URL: `http://localhost:${frontend}` }),
  run("frontend", ["--port", String(frontend), "--strictPort"], { BACKEND_PORT: String(backend) }),
];

// One without the other is no use: when either stops, so does the rest.
const code = await Promise.race(apps.map((app) => app.exited));
for (const app of apps) app.kill();
process.exit(code);

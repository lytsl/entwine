import { join } from "node:path";
import { readEnv } from "./env";
import { createServer } from "./server";

const { app } = await createServer();
const { port, backup } = readEnv();
if (backup.bucket) {
  // A process of its own: bun:sqlite would hold this one's only thread for as long as the databases take to copy.
  // The next check is an hour after this one ends, so two never run together.
  const backUpIfDue = async () => {
    await Bun.spawn([process.execPath, join(import.meta.dir, "../scripts/backup.ts"), "--if-due"], {
      stdio: ["ignore", "inherit", "inherit"],
    }).exited;
    setTimeout(backUpIfDue, 60 * 60 * 1000);
  };
  void backUpIfDue();
}
// No idle timeout: the sync stream stays open.
Bun.serve({
  fetch: (request, server) => app.fetch(request, { ip: server.requestIP(request)?.address }),
  port,
  idleTimeout: 0,
});
console.log(`[entwine] backend on http://localhost:${port}`);

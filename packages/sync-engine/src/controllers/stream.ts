import { type Change, HEARTBEAT_MS } from "../protocol";
import type { Tenant, Tenants } from "../storage/tenants";

const encoder = new TextEncoder();

export interface StreamOptions {
  /** The member listening: changes to rows another member owns are left out. */
  reader: string;
  /** Another epoch, a cursor ahead of the log or older than it keeps is answered `reset`. */
  epoch: string | null;
  after: number;
  signal: AbortSignal;
  /**
   * Names a change that ends the member's access; the stream then sends `revoked` and closes, as it does when the
   * tenant is deleted.
   */
  revoked?: (change: Change) => boolean;
  /** Asked at every heartbeat whether the member may still listen; the stream closes when it answers false. */
  check?: () => Promise<boolean>;
  heartbeatMs?: number;
  /** Unsent bytes a reader may fall behind by before the stream is dropped; it catches up from the log. */
  maxBufferedBytes?: number;
}

/**
 * `GET /stream`. It subscribes before reading the backlog and sends each change id once, so a commit racing the
 * catch-up is neither lost nor repeated.
 */
export function stream(tenants: Tenants, tenant: Tenant, options: StreamOptions): Response {
  const heartbeatMs = options.heartbeatMs ?? HEARTBEAT_MS;
  let cleanup: () => void | Promise<void> = () => {};
  const body = new ReadableStream<Uint8Array>(
    {
      async start(controller) {
        let sent = options.after;
        let caughtUp = false;
        let closed = false;
        const pending: [Change[], number][] = [];
        const write = (text: string) => {
          if (!closed) controller.enqueue(encoder.encode(text));
        };
        const end = (error?: Error) => {
          if (closed) return;
          cleanup();
          if (error) controller.error(error);
          else controller.close();
        };
        const revoke = () => {
          write("event: revoked\ndata: {}\n\n");
          end();
        };
        // An event is sent for a commit the reader sees nothing of too: its id moves their position past it.
        const send = (changes: Change[], cursor: number) => {
          if (cursor <= sent || closed) return;
          const fresh = changes.filter((change) => change.id > sent);
          // A reader this far behind is dropped rather than buffered for; it resumes from its cursor.
          if ((controller.desiredSize ?? 0) < 0) return end(new Error("The reader fell too far behind"));
          sent = cursor;
          write(`id: ${sent}\nevent: changes\ndata: ${JSON.stringify(fresh)}\n\n`);
          if (options.revoked && fresh.some(options.revoked)) revoke();
        };
        const unsubscribe = tenants.subscribe(
          tenant.id,
          (changes, cursor) => void (caughtUp ? send(changes, cursor) : pending.push([changes, cursor])),
          // A deleted tenant ends every member's access.
          { reader: options.reader, deleted: revoke },
        );
        const checks = new Set<Promise<void>>();
        const heartbeat = setInterval(() => {
          const check = (async () => {
            if (options.check && !(await options.check().catch(() => false))) return end();
            write(": ping\n\n");
          })();
          checks.add(check);
          void check.finally(() => checks.delete(check));
        }, heartbeatMs);
        cleanup = async () => {
          closed = true;
          clearInterval(heartbeat);
          unsubscribe();
          // The caller may close the session database once cancellation finishes.
          await Promise.allSettled([...checks]);
        };
        options.signal.addEventListener("abort", () => cleanup());
        write(": connected\n\n");
        const reset = () => {
          write("event: reset\ndata: {}\n\n");
          end();
        };
        try {
          const log = await tenant.log();
          if (options.epoch !== log.epoch || options.after > log.cursor) return reset();
          for (;;) {
            // Null when the log was pruned past the position, before the catch-up or between two of its batches.
            const batch = await tenant.changesFor(options.reader, sent);
            if (!batch) return reset();
            if (batch.cursor === sent) break;
            send(batch.changes, batch.cursor);
            if (closed) return;
          }
        } catch (error) {
          return end(error as Error);
        }
        caughtUp = true;
        for (const [changes, cursor] of pending.splice(0)) send(changes, cursor);
      },
      cancel: () => cleanup(),
    },
    new ByteLengthQueuingStrategy({ highWaterMark: options.maxBufferedBytes ?? 4 * 1024 * 1024 }),
  );
  return new Response(body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

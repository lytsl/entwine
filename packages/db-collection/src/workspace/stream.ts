/**
 * A tab's following of the server's change stream. Every tab follows the server itself; the holder of the
 * workspace lock also writes the stream into the device's store.
 */
import { type Change, readEvents } from "@entwine/sync-engine/protocol";
import { finalStatus } from "../errors";
import type { SyncStatus } from "../types/workspace";
import type { Dependents } from "./dependents";
import type { Loader } from "./loader";
import type { Outbox } from "./outbox";
import type { Rows } from "./rows";
import { backoff, type Tab } from "./tab";

export class Stream {
  private connection?: AbortController;
  /** Where the next stream connection starts, when the store needs changes this tab already has. */
  private replayFrom?: number;

  constructor(
    private readonly tab: Tab,
    private readonly rows: Rows,
    private readonly loader: Loader,
    private readonly dependents: Dependents,
    private readonly outbox: Outbox,
  ) {}

  async follow(): Promise<void> {
    const { tab } = this;
    for (let attempt = 0; !tab.closed; attempt++) {
      const outcome = await this.connect(() => {
        attempt = 0;
      });
      if (outcome === "restart") {
        attempt = 0;
        continue;
      }
      if (outcome === "reset") {
        tab.setStatus("connecting");
        try {
          await this.loader.rebuild();
          attempt = 0;
          continue;
        } catch (error) {
          const final = finalStatus(error);
          if (final) return tab.setStatus(final);
        }
      } else if (outcome) return tab.setStatus(outcome);
      if (tab.closed) return;
      tab.setStatus("offline");
      await tab.sleep(backoff(attempt));
    }
  }

  /**
   * Answers the final status the connection reached, `reset`, or `restart` when the leader needs changes again for
   * the store. It is dropped when nothing, not even a heartbeat, arrives for `stallMs`.
   */
  private async connect(onOpen: () => void): Promise<SyncStatus | "reset" | "restart" | undefined> {
    const { tab } = this;
    const connection = new AbortController();
    this.connection = connection;
    let stall = (_: Error) => {};
    const end = () => {
      stall(new Error("The stream stopped"));
      connection.abort();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(end, tab.stallMs);
    };
    tab.abort.signal.addEventListener("abort", end);
    connection.signal.addEventListener("abort", () => stall(new Error("The stream was restarted")));
    // A browser that loses its network may keep the stream open without delivering; drop it at once.
    globalThis.addEventListener?.("offline", end);
    touch();
    let from = this.replayFrom ?? tab.cursor;
    this.replayFrom = undefined;
    try {
      const query = `epoch=${encodeURIComponent(tab.epoch)}&after=${from}`;
      const response = await tab.fetch(`${tab.url}/stream?${query}`, { signal: connection.signal });
      if (response.status === 401) return "unauthenticated";
      if (response.status === 403) return "revoked";
      if (!response.ok || !response.body) return;
      tab.setStatus("live");
      onOpen();
      void this.outbox.adoptOrphans().catch((error) => tab.report(error));
      const watched = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          start: (controller) => {
            stall = (error) => controller.error(error);
          },
          transform: (chunk, controller) => {
            touch();
            controller.enqueue(chunk);
          },
        }),
      );
      for await (const event of readEvents(watched)) {
        if (event.event === "changes") from = this.receive(JSON.parse(event.data) as Change[], from, Number(event.id));
        else if (event.event === "revoked") return "revoked";
        else if (event.event === "reset") return "reset";
      }
    } catch {
      // A dropped or stalled connection; `follow` reconnects.
    } finally {
      clearTimeout(timer);
      tab.abort.signal.removeEventListener("abort", end);
      globalThis.removeEventListener?.("offline", end);
      connection.abort();
    }
    if (connection.signal.reason === "restart") return "restart";
  }

  /**
   * Applies one commit of the stream, which continues from `from`, and answers where the stream now stands: `last`,
   * the event's id, which is ahead of the changes when the commit's last rows are not this member's to read.
   */
  private receive(changes: Change[], from: number, last: number): number {
    const { tab } = this;
    if (tab.closed || !(last > from)) return from;
    const rows = changes.map((c) => ({ model: c.model, id: c.rowId, version: c.id, data: c.data }));
    const changed = new Map(
      rows.map((row, i) => [row, { previous: this.rows.data(row.model, row.id), inserted: changes[i].inserted }]),
    );
    if (rows.length) {
      this.rows.apply(rows);
      this.dependents.load(changed);
    }
    tab.cursor = Math.max(tab.cursor, last);
    if (tab.role === "leader") {
      const position = { ...tab.position, cursor: last };
      tab.persist(async (store) => {
        // A commit of a log the tab has since left is not the store's to take.
        if (!(await store.commit(position, from, rows)) && position.epoch === tab.epoch)
          this.resync().catch((error) => tab.report(error));
      });
    }
    tab.settleWaiters();
    tab.notify();
    return last;
  }

  /** Brings the store up to this tab's rows: by replaying the stream from the store's cursor, or by a rebuild. */
  async resync(): Promise<void> {
    const { tab } = this;
    // What this tab already queued for the store counts: a bootstrap being stored is not a store to rebuild.
    await tab.stored;
    const stored = await tab.local!.store.position();
    if (stored?.schema !== tab.schema.version || stored.epoch !== tab.epoch) await this.loader.rebuild();
    else if (stored.cursor < tab.cursor) {
      this.replayFrom = stored.cursor;
      this.connection?.abort("restart");
    }
  }
}

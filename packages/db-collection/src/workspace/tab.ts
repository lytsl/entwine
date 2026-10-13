/** What the parts of a workspace's sync share in one tab. */
import { HEARTBEAT_MS, type RowMap, type Schema } from "@entwine/sync-engine/protocol";
import type { LocalStore } from "../device/local-store";
import type { Store } from "../device/store";
import { closedError, SyncError } from "../errors";
import type { Position } from "../types/store";
import type { Fetch, SyncStatus } from "../types/workspace";
import type { WorkspaceOptions } from "./options";

export const backoff = (attempt: number) => Math.min(30_000, 500 * 2 ** attempt) * (0.5 + Math.random() / 2);

export class Tab {
  readonly schema: Schema;
  readonly url: string;
  readonly fetch: Fetch;
  readonly stallMs: number;
  readonly local?: LocalStore;
  readonly id = crypto.randomUUID();
  readonly abort = new AbortController();
  readonly ready: Promise<void>;
  status: SyncStatus = "connecting";
  /** Why loads keep failing while they are tried again: the server cannot be reached, or cannot answer. */
  failing?: SyncError;
  /** `leader` writes the stream to the device, `follower` shares the device's store, `memory` has none. */
  role: "leader" | "follower" | "memory";
  epoch = "";
  cursor = 0;
  /** The locks the tab holds or waits for, let go when it is released. */
  readonly releases: (() => void)[] = [];
  readonly listeners = new Set<() => void>();
  stored: Promise<unknown> = Promise.resolve();
  /** The outbox's writes, apart from `stored`: a transaction is kept, and sent, while a large load is being stored. */
  kept: Promise<unknown> = Promise.resolve();
  resolveReady!: () => void;
  rejectReady!: (error: Error) => void;

  private readonly waiters: { cursor: number; epoch: string; resolve(): void; reject(error: Error): void }[] = [];
  private readonly wakers = new Set<() => void>();
  private storageFailed = false;

  constructor(private readonly options: WorkspaceOptions<RowMap>) {
    this.schema = options.schema;
    this.url = options.url;
    this.fetch = options.fetch ?? ((url, init) => fetch(url, { credentials: "same-origin", ...init }));
    this.stallMs = options.stallMs ?? 2 * HEARTBEAT_MS;
    this.local = options.local;
    this.role = this.local ? "follower" : "memory";
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.ready.catch(() => {});
  }

  get closed(): boolean {
    return this.abort.signal.aborted;
  }
  get position(): Position {
    return { schema: this.schema.version, epoch: this.epoch, cursor: this.cursor };
  }
  lock(name: string): string {
    return `${this.local!.name}:${name}`;
  }

  /** Resolves once the stream has applied changes up to `cursor`, or the tab moved to another log. */
  awaitCursor(cursor: number): Promise<void> {
    if (cursor <= this.cursor) return Promise.resolve();
    if (this.closed) return Promise.reject(closedError());
    return new Promise((resolve, reject) => this.waiters.push({ cursor, epoch: this.epoch, resolve, reject }));
  }

  settleWaiters(): void {
    for (const waiter of this.waiters.filter((w) => w.cursor <= this.cursor || w.epoch !== this.epoch)) {
      this.waiters.splice(this.waiters.indexOf(waiter), 1);
      waiter.resolve();
    }
  }

  rejectWaiters(): void {
    for (const waiter of this.waiters.splice(0)) waiter.reject(closedError());
  }

  /**
   * Runs a store write after the ones before it; a release waits for those already queued, so that nothing the
   * outbox kept or dropped is lost. Only the first failure in a row is reported.
   */
  persist(write: (store: Store) => Promise<unknown>, outbox = false): void {
    const local = this.local;
    if (!local) return;
    const done = (outbox ? this.kept : this.stored)
      .then(() => write(local.store))
      .then(
        () => {
          this.storageFailed = false;
        },
        (error) => {
          if (!this.storageFailed) this.report(new SyncError("failed", `Could not store the workspace: ${error}`));
          this.storageFailed = true;
        },
      );
    if (outbox) this.kept = done;
    else this.stored = done;
  }

  report(error: unknown): void {
    if (!this.closed)
      this.options.onError?.(error instanceof SyncError ? error : new SyncError("failed", String(error)));
  }

  /** Waits `ms`, or less if the tab closes, the browser comes back online or the stream reconnects. */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wakers.delete(done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.wakers.add(done);
      this.abort.signal.addEventListener("abort", done, { once: true });
    });
  }
  readonly wake = () => {
    for (const waker of [...this.wakers]) waker();
  };

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setStatus(status: SyncStatus): void {
    this.status = status;
    if (status === "live") this.wake();
    this.notify();
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }
}

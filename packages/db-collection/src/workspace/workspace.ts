/**
 * One workspace in one tab: a TanStack DB collection per model, fed from the server.
 *
 * - Every row the tab holds carries its server version, and is only replaced by a newer one (`rows.ts`).
 * - The bootstrap loads the `instant` models. `explicit` models load when a page asks (`load`), `on-demand` models
 *   when a live query does; loaded queries are remembered (`loader.ts`), and the stream delivers every change of
 *   every model (`stream.ts`). A change that brings a row into a nested selection of a held query loads what that
 *   row brings with it (`dependents.ts`).
 * - Writes are TanStack transactions: they show at once, reach the server one at a time in the order they were
 *   made, and settle once the stream has brought their result back (`outbox.ts`).
 * - Every tab follows the server itself. Tabs of one member share a store on the device: the holder of the
 *   workspace lock writes the stream into it, every tab writes its loads and keeps its unconfirmed transactions
 *   there, and the lock holder sends the transactions of tabs that closed before the server answered.
 */
import type { Query, Row, RowMap } from "@entwine/sync-engine/protocol";
import { createCollection, type Transaction } from "@tanstack/db";
import { finalStatus } from "../errors";
import type { Collections, LiveQuery, SyncParams, SyncStatus } from "../types/workspace";
import { toEntry } from "../utils/entries";
import { Dependents } from "./dependents";
import { History } from "./history";
import { Loader } from "./loader";
import type { WorkspaceOptions } from "./options";
import { Outbox } from "./outbox";
import { Rows } from "./rows";
import { Stream } from "./stream";
import { Tab } from "./tab";

/** Workspaces open in this tab, released before the device's copies are deleted. */
const opened = new Set<Workspace<RowMap>>();
export const releaseAll = () => Promise.all([...opened].map((workspace) => workspace.release()));

export class Workspace<R extends RowMap = RowMap> {
  readonly collections: Collections<R>;
  readonly history: History;
  readonly ready: Promise<void>;

  private readonly tab: Tab;
  private readonly rows: Rows;
  private readonly loader: Loader;
  private readonly outbox: Outbox;
  private readonly stream: Stream;
  private readonly queries = new Set<LiveQuery>();
  private released?: Promise<void>;

  constructor(options: WorkspaceOptions<R>) {
    const tab = new Tab(options as unknown as WorkspaceOptions<RowMap>);
    this.tab = tab;
    this.ready = tab.ready;
    this.rows = new Rows(tab);
    this.loader = new Loader(tab, this.rows);
    const handler = ({ transaction }: { transaction: Transaction }) => this.outbox.send(toEntry(transaction));
    this.collections = Object.fromEntries(
      Object.entries(tab.schema.models).map(([model, definition]) => [
        model,
        createCollection({
          id: model,
          getKey: (row: Row) => row.id,
          schema: definition.schema,
          startSync: true,
          gcTime: Number.POSITIVE_INFINITY,
          syncMode: definition.load === "on-demand" ? "on-demand" : "eager",
          sync: { rowUpdateMode: "full", sync: (params: SyncParams) => this.loader.register(model, params) },
          onInsert: handler,
          onUpdate: handler,
          onDelete: handler,
        } as never),
      ]),
    ) as unknown as Collections<R>;
    const collections = this.collections as unknown as Collections<RowMap>;
    this.outbox = new Outbox(tab, collections);
    this.stream = new Stream(tab, this.rows, this.loader, new Dependents(tab, this.loader, collections), this.outbox);
    this.history = new History(
      collections,
      (fn, revert) => this.outbox.begin(fn, revert),
      options.session,
      `entwine-history:${tab.url}`,
      () => !!tab.local && tab.closed,
    );
    this.start().catch((error) => {
      tab.rejectReady(error);
      const final = finalStatus(error);
      if (final) tab.setStatus(final);
    });
    globalThis.addEventListener?.("online", tab.wake);
    opened.add(this as unknown as Workspace<RowMap>);
  }

  get status(): SyncStatus {
    return this.tab.status;
  }
  get role(): "leader" | "follower" | "memory" {
    return this.tab.role;
  }
  get epoch(): string {
    return this.tab.epoch;
  }
  get cursor(): number {
    return this.tab.cursor;
  }

  /** Why the workspace's loads keep failing, while they are tried again. */
  get failing(): Error | undefined {
    return this.tab.failing;
  }

  /** Tries now what is waiting to be tried again. */
  retry(): void {
    this.tab.wake();
  }

  private async start(): Promise<void> {
    const { tab } = this;
    const local = tab.local;
    let hydrated = false;
    if (local) {
      tab.releases.push(local.locks.hold(tab.lock(`tab:${tab.id}`), () => {}));
      tab.releases.push(
        local.locks.hold(tab.lock("leader"), () => void this.promote().catch((error) => tab.report(error))),
      );
      // Give a free lock its turn, so that a first visit's leader stores its bootstrap.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const snapshot = await local.store.read();
      // Queued, not awaited: a busy store must not hold up a first visit, whose bootstrap comes from the server.
      tab.persist((store) => store.init());
      if (snapshot?.position.schema === tab.schema.version) {
        tab.epoch = snapshot.position.epoch;
        tab.cursor = snapshot.position.cursor;
        this.rows.apply(snapshot.rows);
        this.loader.restore(snapshot.loaded);
        hydrated = true;
      }
    }
    if (!tab.epoch) await this.loader.rebuild();
    // A reload shows, and sends, what the tab before it could not.
    if (hydrated) await this.outbox.adoptOrphans();
    this.rows.markReady();
    tab.resolveReady();
    tab.notify();
    void this.stream.follow();
  }

  private async promote(): Promise<void> {
    const { tab } = this;
    tab.role = "leader";
    tab.notify();
    await tab.ready.catch(() => {});
    if (tab.closed || tab.status === "revoked" || tab.status === "unauthenticated") return;
    await this.stream.resync().catch((error) => tab.report(error));
    await this.outbox.adoptOrphans();
  }

  load(queries: readonly Query[]): Promise<void> {
    return this.loader.load(queries);
  }

  find(queries: Query[]): ReturnType<Loader["find"]> {
    return this.loader.find(queries);
  }

  /** Counts the times the tab loaded the workspace anew, dropping the rows its searches had found. */
  get rebuilds(): number {
    return this.loader.rebuilds;
  }

  isLoaded(query: Query): boolean {
    return this.loader.isLoaded(query);
  }

  /** Resolves once the server's result is back, or rejects if refused. */
  async mutate(fn: () => void): Promise<void> {
    const { transaction, done } = this.outbox.begin(fn);
    if (!transaction.mutations.length) return done;
    const step = this.history.record(transaction);
    try {
      await done;
    } catch (error) {
      if (!this.tab.local || !this.tab.closed) this.history.forget(step);
      throw error;
    }
  }

  queued(): number {
    return this.outbox.queued();
  }

  counts(): Record<string, number> {
    return this.rows.counts();
  }

  subscribe(listener: () => void): () => void {
    return this.tab.subscribe(listener);
  }

  /** Retire dependent queries before their source collections, even while their idle GC is waiting. */
  trackQuery(query: LiveQuery): void {
    if (this.queries.has(query)) return;
    if (this.tab.closed) return void query.cleanup();
    this.queries.add(query);
    const unsubscribe = query.on("status:cleaned-up", () => {
      this.queries.delete(query);
      unsubscribe();
    });
  }

  /**
   * No request is sent and no row written after this. Unconfirmed writes are rejected here and stay on the device,
   * for the next tab to send. A member who lost access keeps nothing of the workspace.
   */
  release(): Promise<void> {
    this.released ??= (async () => {
      const { tab } = this;
      const revoked = tab.status === "revoked";
      opened.delete(this as unknown as Workspace<RowMap>);
      tab.abort.abort();
      globalThis.removeEventListener?.("online", tab.wake);
      tab.rejectWaiters();
      this.outbox.close();
      await Promise.all([tab.stored, tab.kept]);
      await Promise.all([...this.queries].map((query) => query.cleanup()));
      await Promise.all(Object.values(this.collections).map((collection) => collection.cleanup()));
      for (const release of tab.releases.splice(0)) release();
      await tab.local?.close();
      if (revoked) {
        this.history.clear();
        await tab.local?.destroy();
      }
      tab.listeners.clear();
    })();
    return this.released;
  }
}

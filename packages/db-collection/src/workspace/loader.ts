/**
 * The queries a tab holds rows for, and their loads. The bootstrap loads the `instant` models; `explicit` models
 * load when a page asks (`load`), `on-demand` models when a live query does. Loaded queries are remembered, and
 * those pages and live queries still hold are loaded again after a rebuild.
 */
import type { LoadResponse, Query } from "@entwine/sync-engine/protocol";
import type { LoadSubsetOptions } from "@tanstack/db";
import { closedError, failure, SyncError } from "../errors";
import type { SyncParams } from "../types/workspace";
import { versioned } from "../utils/entries";
import { queryKey, subsetQuery } from "../utils/queries";
import type { Rows } from "./rows";
import { backoff, type Tab } from "./tab";

export class Loader {
  private readonly loaded = new Set<string>();
  private readonly loading = new Map<string, Promise<void>>();
  /** What pages asked to load, and what live queries hold: loaded again after a rebuild. */
  private readonly requested = new Map<string, Query>();
  private readonly held = new Map<LoadSubsetOptions, Query>();
  private rebuilding?: Promise<void>;
  /** Counts the rebuilds: what a search found before one is no longer held. */
  rebuilds = 0;

  constructor(
    private readonly tab: Tab,
    private readonly rows: Rows,
  ) {}

  /** Called by each collection when its sync starts. On-demand collections load what their live queries ask. */
  register(model: string, params: SyncParams) {
    const cleanup = this.rows.attach(model, params);
    if (this.tab.schema.models[model].load !== "on-demand") return { cleanup };
    return {
      cleanup,
      loadSubset: (options: LoadSubsetOptions) => {
        const query = subsetQuery(model, options);
        this.held.set(options, query);
        return this.isLoaded(query) || this.fetchRows([query]);
      },
      unloadSubset: (options: LoadSubsetOptions) => void this.held.delete(options),
    };
  }

  /** Takes the queries the device's store holds the rows of. */
  restore(keys: readonly string[]): void {
    for (const key of keys) this.loaded.add(key);
  }

  holding(): Query[] {
    return [...this.requested.values(), ...this.held.values()];
  }

  /** Loads the `instant` models again, in place of everything the tab holds, and reloads what pages still show. */
  rebuild(): Promise<void> {
    this.rebuilding ??= (async () => {
      const { tab } = this;
      const instant = Object.keys(tab.schema.models).filter((model) => tab.schema.models[model].load === "instant");
      const response = await this.fetchLoad(instant.map((model) => ({ model })));
      const rows = versioned(response);
      this.rows.forget();
      this.loaded.clear();
      this.rebuilds++;
      this.rows.apply(rows, true);
      tab.epoch = response.epoch;
      tab.cursor = response.cursor;
      tab.settleWaiters();
      if (tab.role === "leader") tab.persist((store) => store.reset(tab.position, rows));
      tab.notify();
      for (const query of this.holding()) this.fetchRows([query]).catch(() => {});
    })().finally(() => {
      this.rebuilding = undefined;
    });
    return this.rebuilding;
  }

  /** A page's queries are loaded again after a rebuild. */
  load(queries: readonly Query[]): Promise<void> {
    for (const query of queries) this.requested.set(queryKey(query), query);
    const missing = queries.filter((query) => !this.isLoaded(query));
    return missing.length ? this.fetchRows(missing) : Promise.resolve();
  }

  /**
   * The rows a search found are kept current by the stream like every row, but the search is not held: it is not
   * loaded again after a rebuild, and asking it again asks the server again. Answers what the server found, each
   * model's rows in their query's order, or nothing when the server's file was rebuilt meanwhile.
   */
  async find(queries: Query[]): Promise<Pick<LoadResponse, "rows" | "counts">> {
    await this.tab.ready;
    const response = await this.fetchLoad(queries);
    if (response.epoch !== this.tab.epoch || this.tab.closed) return { rows: {} };
    const rows = versioned(response);
    this.rows.apply(rows);
    const { schema, epoch } = this.tab.position;
    this.tab.persist((store) => store.load({ schema, epoch }, rows, []));
    this.tab.notify();
    return response;
  }

  isLoaded(query: Query): boolean {
    const where = Object.entries(query.where ?? {});
    return (
      this.tab.schema.models[query.model]?.load === "instant" ||
      this.loaded.has(queryKey({ model: query.model })) ||
      this.loaded.has(queryKey(query)) ||
      // One row by its id, whose server version the tab has, deleted or not.
      (where.length === 1 && where[0][0] === "id" && this.rows.has(query.model, where[0][1]))
    );
  }

  /** Fetches queries, each once at a time however many callers ask for it. */
  fetchRows(queries: readonly Query[]): Promise<void> {
    const waits: Promise<void>[] = [];
    const missing: Query[] = [];
    for (const query of queries) {
      const pending = this.loading.get(queryKey(query));
      if (pending) waits.push(pending);
      else missing.push(query);
    }
    if (missing.length) {
      const promise = this.read(missing);
      promise.catch(() => {});
      for (const query of missing) {
        const key = queryKey(query);
        this.loading.set(key, promise);
        promise.finally(() => this.loading.get(key) === promise && this.loading.delete(key)).catch(() => {});
      }
      waits.push(promise);
    }
    return Promise.all(waits).then(() => {});
  }

  private async read(queries: Query[]): Promise<void> {
    await this.tab.ready;
    for (;;) {
      const response = await this.fetchLoad(queries);
      // The server's file was rebuilt: so is the tab, and the queries are asked again of the new log.
      if (response.epoch !== this.tab.epoch) {
        await this.rebuild();
        continue;
      }
      const rows = versioned(response);
      this.rows.apply(rows);
      const keys = queries.map(queryKey);
      for (const key of keys) this.loaded.add(key);
      const { schema, epoch } = this.tab.position;
      this.tab.persist((store) => store.load({ schema, epoch }, rows, keys));
      this.tab.notify();
      return;
    }
  }

  private fails(error?: SyncError): void {
    if (!error && !this.tab.failing) return;
    this.tab.failing = error;
    this.tab.notify();
  }

  /** `POST /load`, retried until the server answers; a refusal is thrown. */
  private async fetchLoad(queries: Query[]): Promise<LoadResponse> {
    for (let attempt = 0; ; attempt++) {
      if (this.tab.closed) throw closedError();
      const response = await this.tab
        .fetch(`${this.tab.url}/load`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries }),
          signal: this.tab.abort.signal,
        })
        .catch(() => undefined);
      if (response?.ok) {
        this.fails();
        return (await response.json()) as LoadResponse;
      }
      if (response && response.status < 500 && response.status !== 429) throw await failure(response);
      // One failure is a blip: said from the second.
      if (attempt && response?.status !== 429)
        this.fails(response ? await failure(response) : new SyncError("offline", "The server could not be reached"));
      await this.tab.sleep(backoff(attempt));
    }
  }
}

/**
 * The server's rows as the tab holds them. Every row carries its server version (the change id that wrote it, or
 * the cursor of the load that read it) and is only replaced by a newer one, so the bootstrap, the stream, loads and
 * the stored copy may arrive in any order.
 */
import type { Row } from "@entwine/sync-engine/protocol";
import type { VersionedRow } from "../types/store";
import type { SyncParams } from "../types/workspace";
import type { Tab } from "./tab";

const key = (model: string, id: string) => `${model}\0${id}`;

export class Rows {
  private readonly params = new Map<string, SyncParams>();
  /** The server's version of every row the tab has seen, deleted ones included, without optimistic writes. */
  private readonly synced = new Map<string, { version: number; data: Row | null }>();

  constructor(private readonly tab: Tab) {}

  attach(model: string, params: SyncParams): () => void {
    this.params.set(model, params);
    return () => void this.params.delete(model);
  }

  markReady(): void {
    for (const params of this.params.values()) params.markReady();
  }

  /**
   * A row is written only if newer than the version the tab holds. A truncating write replaces everything the
   * server sent before; optimistic writes stay on top.
   */
  apply(rows: readonly VersionedRow[], truncate = false): void {
    if (this.tab.closed) return;
    const byModel = Map.groupBy(rows, (row) => row.model);
    for (const [model, params] of this.params) {
      const changes = byModel.get(model);
      if (!changes && !truncate) continue;
      params.begin();
      if (truncate) params.truncate();
      for (const { id, version, data } of changes ?? []) {
        const at = key(model, id);
        if ((this.synced.get(at)?.version ?? -1) >= version) continue;
        this.synced.set(at, { version, data });
        if (data) params.write({ type: "update", value: data });
        else params.write({ type: "delete", key: id });
      }
      params.commit();
    }
  }

  /** Whether the tab has a server version of the row, deleted or not. */
  has(model: string, id: unknown): boolean {
    return this.synced.has(key(model, String(id)));
  }

  /** Null once deleted, undefined if the server never sent the row. */
  data(model: string, id: string): Row | null | undefined {
    return this.synced.get(key(model, id))?.data;
  }

  /** Forgets every version, before a rebuild writes the server's rows anew. */
  forget(): void {
    this.synced.clear();
  }

  /** Row counts per model, for the devtools. */
  counts(): Record<string, number> {
    return Object.fromEntries([...this.params].map(([model, params]) => [model, params.collection.size]));
  }
}

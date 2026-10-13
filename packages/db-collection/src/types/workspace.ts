import type { Row, RowMap } from "@entwine/sync-engine/protocol";
import type { Collection, SyncConfig } from "@tanstack/db";

/** `offline`: reconnecting. `revoked` and `unauthenticated` are final. */
export type SyncStatus = "connecting" | "live" | "offline" | "revoked" | "unauthenticated";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export type Collections<R extends RowMap> = { [M in keyof R & string]: Collection<R[M], string> };

/** A collection of any model, as far as stored writes and undo edit it. */
export interface Writable {
  has(key: string): boolean;
  insert(row: Record<string, unknown>): unknown;
  update(key: string, fn: (draft: Record<string, unknown>) => void): unknown;
  delete(key: string): unknown;
}

/** What a collection hands its sync to write the server's rows with. */
export type SyncParams = Parameters<SyncConfig<Row, string>["sync"]>[0];

export interface LiveQuery {
  cleanup(): Promise<void>;
  on(event: "status:cleaned-up", listener: () => void): () => void;
}

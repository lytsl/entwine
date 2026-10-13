import type { Row, TransactionRequest } from "@entwine/sync-engine/protocol";

export interface Database {
  execute(sql: string, params?: readonly unknown[]): Promise<ReadonlyArray<Record<string, unknown>>>;
}

/** `data` is null once the row is deleted. */
export interface VersionedRow {
  model: string;
  id: string;
  version: number;
  data: Row | null;
}

/** The schema the stored rows fit, and the change log position they are complete up to. */
export interface Position {
  schema: string;
  epoch: string;
  cursor: number;
}

export interface Snapshot {
  position: Position;
  rows: VersionedRow[];
  /** Keys of the queries whose rows are all stored. */
  loaded: string[];
}

/** A transaction kept until the server answers it, with the writes that show it optimistically. */
export interface Entry {
  request: TransactionRequest;
  mutations: { model: string; type: "insert" | "update" | "delete"; key: string; value: Record<string, unknown> }[];
}

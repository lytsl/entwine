import type { StandardSchemaV1 } from "@standard-schema/spec";

/** Every synced row has a string `id`, unique in its model. */
export type Row = { id: string };
export type RowMap = Record<string, Row>;

/**
 * How a client gets a model's rows:
 * - `instant`: in the bootstrap, all of them;
 * - `explicit`: only the rows of the queries a page asks for (`workspace.load`);
 * - `on-demand`: the rows a live query's `where` asks for, as TanStack DB's on-demand sync mode requests them.
 *
 * Whatever the strategy, the stream delivers every change of every model a member may read.
 */
export type LoadStrategy = "instant" | "explicit" | "on-demand";

export interface ModelDefinition<T = unknown> {
  load: LoadStrategy;
  /** Validates the rows a client writes optimistically. */
  schema?: StandardSchemaV1<unknown, T>;
  /**
   * The field that holds the id of the member a row belongs to. Such a row is loaded by and streamed to that member
   * only, and no other member's client may write it. The field never changes once the row is written.
   */
  owner?: string;
}

export interface Schema<R extends RowMap = RowMap> {
  /** Changes whenever rows stored under the previous version would no longer fit; stored rows are then dropped. */
  version: string;
  models: { [M in keyof R & string]: ModelDefinition<R[M]> };
}

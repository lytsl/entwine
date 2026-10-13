import type { Database } from "bun:sqlite";
import type { Change, Row } from "../protocol";
import type { Connection } from "./connection";

/** The row a change replaced and who wrote it never go on the wire. */
export interface LoggedChange extends Omit<Change, "inserted"> {
  before: Row | null;
  txid: string | null;
  actorId: string | null;
  createdAt: number;
}

export const parseChange = (row: Record<string, unknown>): LoggedChange => ({
  id: row.id as number,
  model: row.model as string,
  rowId: row.rowId as string,
  data: row.data == null ? null : JSON.parse(row.data as string),
  before: row.before == null ? null : JSON.parse(row.before as string),
  txid: (row.txid as string | null) ?? null,
  actorId: (row.actorId as string | null) ?? null,
  createdAt: row.createdAt as number,
});

const toWire = ({ id, model, rowId, data, before }: LoggedChange): Change => ({
  id,
  model,
  rowId,
  data,
  inserted: !before && !!data,
});

/** Runs inside the transaction whose changes it appends. */
export function appendChanges(db: Database, changes: LoggedChange[]): void {
  const insert = db.query(
    "INSERT INTO change (id, model, rowId, data, before, txid, actorId, createdAt) VALUES (?,?,?,?,?,?,?,?)",
  );
  for (const c of changes) {
    const json = (row: Row | null) => (row ? JSON.stringify(row) : null);
    insert.run(c.id, c.model, c.rowId, json(c.data), json(c.before), c.txid, c.actorId, c.createdAt);
  }
}

/** What `reader` may see of `changes`: not the rows other members own. Without a reader, the server's view. */
export function visible(connection: Connection, changes: readonly LoggedChange[], reader?: string): Change[] {
  const mine = (change: LoggedChange) => {
    const owner = reader === undefined ? undefined : connection.owner(change.model);
    return !owner || (change.data ?? change.before)?.[owner as keyof Row] === reader;
  };
  return changes.filter(mine).map(toWire);
}

/** A reader's part of a stretch of the log, and the position the stretch ends at. */
export interface Batch {
  changes: Change[];
  cursor: number;
}

/** Null when the log no longer holds every change after `after`. */
export function changesAfter(connection: Connection, after: number, limit: number, reader?: string): Batch | null {
  if (after < connection.log.floor) return null;
  const rows = connection.db.query("SELECT * FROM change WHERE id > ? ORDER BY id LIMIT ?").all(after, limit);
  const logged = (rows as Record<string, unknown>[]).map(parseChange);
  return { changes: visible(connection, logged, reader), cursor: logged.at(-1)?.id ?? after };
}

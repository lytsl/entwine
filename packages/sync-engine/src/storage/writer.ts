import type { SQLQueryBindings } from "bun:sqlite";
import { fail } from "../errors/write-error";
import type { Query, Row, RowMap } from "../protocol";
import { type LoggedChange, parseChange } from "./change-log";
import { type Connection, quote, turn } from "./connection";
import { compile } from "./query";

type Model<R> = keyof R & string;

/** A tenant's rows inside one write. Every write through it becomes a change. */
export interface Writer<R extends RowMap = RowMap> {
  get<M extends Model<R>>(model: M, id: string): Promise<R[M] | null>;
  list<M extends Model<R>>(model: M, where?: Partial<R[M]>): Promise<R[M][]>;
  insert<M extends Model<R>>(model: M, row: R[M]): Promise<void>;
  update<M extends Model<R>>(model: M, id: string, patch: Partial<R[M]>): Promise<void>;
  delete(model: Model<R>, id: string): Promise<void>;
  /** In order; none once the log no longer holds all of them. */
  changesOf(txid: string): Promise<LoggedChange[]>;
}

/** Row writes one transaction makes before the process's other requests get a turn. */
const WRITES_PER_TURN = 256;

export class LoggingWriter implements Writer {
  readonly changes: Omit<LoggedChange, "id" | "txid" | "actorId" | "createdAt">[] = [];
  constructor(
    private readonly connection: Connection,
    private readonly retainedSince: number,
  ) {}

  /** The tenant's queue is still held across the turn, so nothing else reads the open transaction. */
  private async log(change: (typeof this.changes)[number]): Promise<void> {
    this.changes.push(change);
    if (this.changes.length % WRITES_PER_TURN === 0) await turn();
  }
  private all(query: Query): Row[] {
    const params: SQLQueryBindings[] = [];
    return this.connection.db.query(compile(this.connection, query, params)).all(...params) as Row[];
  }
  /** Checks the fields a write names, which end up in SQL. */
  private fields(model: string, row: object): string[] {
    const columns = this.connection.columns(model);
    const names = Object.keys(row);
    for (const name of names) if (!columns.has(name)) fail(`${model} has no field ${name}`);
    return names;
  }

  async get(model: string, id: string) {
    return this.all({ model, where: { id } })[0] ?? null;
  }
  async list(model: string, where: Record<string, unknown> = {}) {
    return this.all({ model, where: where as Query["where"] });
  }
  async insert(model: string, row: Row) {
    const names = this.fields(model, row);
    this.connection.db
      .query(`INSERT INTO ${quote(model)} (${names.map(quote).join(",")}) VALUES (${names.map(() => "?").join(",")})`)
      .run(...(Object.values(row) as SQLQueryBindings[]));
    await this.log({ model, rowId: row.id, data: row, before: null });
  }
  async update(model: string, id: string, patch: Record<string, unknown>) {
    const names = this.fields(model, patch);
    if (!names.length) return;
    const before = await this.get(model, id);
    const owner = this.connection.owner(model);
    if (owner && before && owner in patch && patch[owner] !== (before as Record<string, unknown>)[owner])
      fail(`${model}.${owner} says whose the row is, and cannot change`);
    const data = this.connection.db
      .query(`UPDATE ${quote(model)} SET ${names.map((n) => `${quote(n)} = ?`).join(",")} WHERE id = ? RETURNING *`)
      .get(...(Object.values(patch) as SQLQueryBindings[]), id) as Row | null;
    if (data) await this.log({ model, rowId: id, data, before });
  }
  async delete(model: string, id: string) {
    this.connection.columns(model);
    const before = this.connection.db
      .query(`DELETE FROM ${quote(model)} WHERE id = ? RETURNING *`)
      .get(id) as Row | null;
    if (before) await this.log({ model, rowId: id, data: null, before });
  }
  async changesOf(txid: string) {
    const rows = this.connection.db.query("SELECT * FROM change WHERE txid = ? ORDER BY id").all(txid);
    // Pruning can retain the last row of an expired transaction. Never revert a partial transaction.
    const changes = (rows as Record<string, unknown>[]).map(parseChange);
    return changes.length && changes[0].createdAt < this.retainedSince ? [] : changes;
  }
}

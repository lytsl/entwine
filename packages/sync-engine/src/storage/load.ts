import type { SQLQueryBindings } from "bun:sqlite";
import { fail } from "../errors/write-error";
import type { Count, LoadResponse, Query, Row, Value } from "../protocol";
import { type Connection, turn } from "./connection";
import { compile } from "./query";

const MAX_QUERIES = 100;

/** Runs inside one job of the tenant's queue. */
export async function loadRows(c: Connection, queries: readonly Query[], reader?: string): Promise<LoadResponse> {
  if (queries.length > MAX_QUERIES) fail(`Load at most ${MAX_QUERIES} queries at once`);
  const rows: Record<string, Map<string, Row>> = {};
  const counts: Record<number, Count[]> = {};
  const asked = new Map<string, Count[] | undefined>();
  for (const [at, query] of queries.entries()) {
    if (!query || typeof query.model !== "string") fail("A query names a model");
    const key = JSON.stringify(query);
    if (asked.has(key)) {
      const counted = asked.get(key);
      if (counted) counts[at] = counted;
      continue;
    }
    // The tenant's queue keeps its writes out across the turn, so every query reads the same cursor.
    if (asked.size) await turn();
    const params: SQLQueryBindings[] = [];
    const statement = c.db.query(compile(c, query, params, reader));
    if (query.count) {
      const found = statement.values(...params) as Value[][];
      counts[at] = found.map((values) => ({ values: values.slice(0, -1), count: values.at(-1) as number }));
    } else {
      const found = rows[query.model] ?? (rows[query.model] = new Map());
      for (const row of statement.all(...params) as Row[]) found.set(row.id, row);
    }
    asked.set(key, counts[at]);
  }
  return {
    epoch: c.log.epoch,
    cursor: c.log.cursor,
    rows: Object.fromEntries(Object.entries(rows).map(([model, found]) => [model, [...found.values()]])),
    ...(Object.keys(counts).length ? { counts } : {}),
  };
}

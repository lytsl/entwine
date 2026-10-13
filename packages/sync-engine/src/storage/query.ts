import type { SQLQueryBindings } from "bun:sqlite";
import { fail } from "../errors/write-error";
import type { Match, Query, Select, Value, Where } from "../protocol";
import { type Connection, quote } from "./connection";

const MAX_DEPTH = 3;
const MAX_VALUES = 1000;
const MAX_WORDS = 10;
const MAX_LIMIT = 1000;
const MAX_ALTERNATIVES = 10;
const MAX_ORDER = 5;

/**
 * Checks every model and field name against the schema and the file, since they end up in SQL. With a `reader`, a
 * model whose rows have an owner gives only the reader's, at every depth; without one it is the server reading.
 * `params` take the values in the order their placeholders are written.
 */
export function compile(
  connection: Connection,
  query: Query | Select,
  params: SQLQueryBindings[],
  reader?: string,
  depth = 0,
): string {
  if (depth > MAX_DEPTH) fail(`A query nests at most ${MAX_DEPTH} selects`);
  const columns = connection.columns(query.model);
  const field = (name: string) => (columns.has(name) ? quote(name) : fail(`${query.model} has no field ${name}`));
  const value = (v: unknown): Value =>
    v === null || typeof v === "string" || typeof v === "number" ? v : fail("A query value is a string or a number");
  const list = <T>(items: unknown, most: number, what: string): T[] =>
    Array.isArray(items) && items.length <= most ? items : fail(`A query has at most ${most} ${what}`);
  const nested = (select: Select) =>
    typeof select?.select === "string"
      ? compile(connection, select, params, reader, depth + 1)
      : fail("A nested query selects a field");

  const condition = (column: string, match: Match): string => {
    if (match === null) return `${column} IS NULL`;
    if (Array.isArray(match)) {
      const values = list<unknown>(match, MAX_VALUES, "values").map(value);
      const given = values.filter((v) => v !== null);
      params.push(...given);
      const among = `${column} IN (${given.map(() => "?").join(",")})`;
      return given.length < values.length ? `(${among} OR ${column} IS NULL)` : among;
    }
    if (typeof match !== "object") {
      params.push(value(match));
      return `${column} = ?`;
    }
    if ("contains" in match) {
      const words = match.contains;
      if (!Array.isArray(words) || !words.length || words.length > MAX_WORDS)
        fail(`A search has 1 to ${MAX_WORDS} words`);
      for (const word of words) {
        if (typeof word !== "string" || !word || word.length > 100) fail("A search word is 1 to 100 characters");
        params.push(`%${word.replace(/[\\%_]/g, "\\$&")}%`);
      }
      return words.map(() => `${column} LIKE ? ESCAPE '\\'`).join(" AND ");
    }
    if ("not" in match) return `${column} NOT IN (${nested(match.not)})`;
    if ("select" in match || "model" in match) return `${column} IN (${nested(match as Select)})`;
    const ends = (["from", "to"] as const).filter((end) => match[end] !== undefined);
    if (!ends.length || Object.keys(match).length > ends.length) fail("A query value is a string or a number");
    return ends
      .map((end) => {
        const bound = value(match[end]);
        if (bound === null) fail("A range ends at a string or a number");
        params.push(bound);
        return `${column} ${end === "from" ? ">=" : "<="} ?`;
      })
      .join(" AND ");
  };
  const all = (where: Where | undefined): string[] =>
    where && typeof where === "object"
      ? Object.entries(where).map(([name, match]) => condition(field(name), match))
      : where === undefined
        ? []
        : fail("A query's where names fields");

  const conditions = all(query.where);
  for (const alternatives of list<Where[]>(query.any ?? [], MAX_ALTERNATIVES, "groups of alternatives")) {
    const either = list<Where>(alternatives, MAX_ALTERNATIVES, "alternatives").map((where) => {
      const parts = all(where);
      return parts.length ? `(${parts.join(" AND ")})` : fail("An alternative names a field");
    });
    if (!either.length) fail("A group of alternatives holds one");
    conditions.push(`(${either.join(" OR ")})`);
  }
  const owner = connection.owner(query.model);
  if (owner && reader !== undefined) {
    // After the conditions above, whose values are already in `params`.
    params.push(reader);
    conditions.push(`${field(owner)} = ?`);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const from = ` FROM ${quote(query.model)}${where}`;

  if (query.count !== undefined) {
    if ("select" in query || query.order || query.limit !== undefined || query.offset !== undefined)
      fail("A query that counts has no order, limit or selection");
    const by = list<string>(query.count, MAX_ORDER, "counted fields").map(field);
    return `SELECT ${[...by, 'COUNT(*) AS "count"'].join(", ")}${from}${by.length ? ` GROUP BY ${by.join(", ")}` : ""}`;
  }

  const order = list<NonNullable<Query["order"]>[number]>(query.order ?? [], MAX_ORDER, "orders").map((by) => {
    const column = field(by?.field);
    const direction = by.desc ? " DESC" : "";
    if (by.rank === undefined) return `${column} IS NULL, ${column}${direction}`;
    const ranked = list<unknown>(by.rank, MAX_VALUES, "ranked values").map(value);
    params.push(...ranked);
    return `CASE ${column}${ranked.map((_, i) => ` WHEN ? THEN ${i}`).join("")} ELSE ${ranked.length} END${direction}`;
  });
  let limit = "";
  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > MAX_LIMIT)
      fail(`A query's limit is 1 to ${MAX_LIMIT}`);
    limit = ` LIMIT ${query.limit}`;
  }
  if (query.offset !== undefined) {
    if (!limit || !Number.isSafeInteger(query.offset) || query.offset < 0)
      fail("A query's offset is a count of rows to skip, with a limit");
    limit += ` OFFSET ${query.offset}`;
  }
  const selected = "select" in query ? field(query.select) : "*";
  return `SELECT ${selected}${from}${order.length ? ` ORDER BY ${order.join(", ")}` : ""}${limit}`;
}

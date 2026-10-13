import type { Row } from "./schema";

export type Value = string | number | null;

/**
 * What a field is matched against: a value, one of several values, one of the `select`ed values of another query's
 * rows (which may be indirect, `issue.projectId`), the words of a search, a range, or none of a selection.
 */
export type Match = Value | Value[] | Select | Contains | Range | Not;
export type Where = Record<string, Match>;

/**
 * The rows of a model that every `where` field holds for, and one alternative of each group of `any`. Without
 * either, every row of the model.
 */
export interface Query {
  model: string;
  where?: Where;
  any?: Where[][];
  /** Without it the rows come in no order, and a `limit` takes any of them. */
  order?: Order[];
  /** At most this many rows, after skipping `offset` of them. */
  limit?: number;
  offset?: number;
  /**
   * Answers no rows but how many there are of each combination of these fields' values (`LoadResponse.counts`);
   * with no field, how many there are.
   */
  count?: string[];
}
/** A text field that holds every one of the words, in any case: a search, which the server runs. */
export interface Contains {
  contains: string[];
}
/** From `from` up to `to`, both included; either end may be left open. Null is in no range. */
interface Range {
  from?: string | number;
  to?: string | number;
}
/** None of the selected values, which must hold no null. */
interface Not {
  not: Select;
}
/** Ascending unless `desc`, nulls last; with `rank`, in the order of those values, others last. */
export interface Order {
  field: string;
  desc?: boolean;
  rank?: Value[];
}
export interface Select extends Query {
  select: string;
}

/** `values` are of the counted fields, in their order. */
export interface Count {
  values: Value[];
  count: number;
}

/**
 * `POST /load`: the rows are complete as of `cursor` in the change log named `epoch`. A rebuilt tenant file starts
 * a new log, and with it a new epoch.
 */
export interface LoadRequest {
  queries: Query[];
}
export interface LoadResponse {
  epoch: string;
  cursor: number;
  rows: Record<string, Row[]>;
  /** The answer of each query that counts, by its place among the queries. */
  counts?: Record<number, Count[]>;
}

import type { Query, Select, Value } from "@entwine/sync-engine/protocol";
import { extractSimpleComparisons, type LoadSubsetOptions } from "@tanstack/db";

/** A query's identity, whatever order its fields were written in. */
export function queryKey(query: Query): string {
  const sorted = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(sorted)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, sorted((value as Record<string, unknown>)[key])]),
          )
        : value;
  return JSON.stringify(sorted(query));
}

/**
 * Keeps a live query's equality and membership conditions. Other conditions only narrow what it shows, so they are
 * left out; anything the conditions cannot express loads the whole model.
 */
export function subsetQuery(model: string, options: LoadSubsetOptions): Query {
  const where: NonNullable<Query["where"]> = {};
  try {
    for (const { field, operator, value } of extractSimpleComparisons(options.where)) {
      const name = field[field.length - 1];
      if (operator === "eq" && (typeof value === "string" || typeof value === "number")) where[name] = value;
      else if (operator === "in" && Array.isArray(value)) where[name] = value;
    }
  } catch {
    return { model };
  }
  return Object.keys(where).length ? { model, where } : { model };
}

/** Every nested selection in a query, at any depth, with the query narrowed to one of its values. */
export function selections<Q extends Query>(query: Q): { select: Select; narrow(value: Value): Q }[] {
  return Object.entries(query.where ?? {}).flatMap(([field, match]) => {
    if (!match || typeof match !== "object" || Array.isArray(match) || !("select" in match)) return [];
    const at = (condition: Value | Select): Q => ({ ...query, where: { ...query.where, [field]: condition } });
    return [
      { select: match, narrow: (value: Value) => at(value) },
      ...selections(match).map(({ select, narrow }) => ({ select, narrow: (value: Value) => at(narrow(value)) })),
    ];
  });
}

export const isValue = (value: unknown): value is Value => typeof value === "string" || typeof value === "number";
export const field = (row: object, name: string): unknown => (row as Record<string, unknown>)[name];

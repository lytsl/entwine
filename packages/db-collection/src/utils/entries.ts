import type { LoadResponse, RowMap, TransactionRequest } from "@entwine/sync-engine/protocol";
import type { PendingMutation, Transaction } from "@tanstack/db";
import type { Entry, VersionedRow } from "../types/store";
import type { Collections, Writable } from "../types/workspace";

export function toEntry(transaction: Pick<Transaction, "id" | "mutations">, revert?: string): Entry {
  const mutations = transaction.mutations.map((m: PendingMutation) => ({
    model: m.collection.id,
    type: m.type,
    key: String(m.key),
    value: (m.type === "insert" ? m.modified : m.type === "update" ? m.changes : {}) as Record<string, unknown>,
  }));
  const request: TransactionRequest = revert ? { id: transaction.id, revert } : { id: transaction.id, mutations };
  return { request, mutations };
}

export const versioned = (response: LoadResponse): VersionedRow[] =>
  Object.entries(response.rows).flatMap(([model, rows]) =>
    rows.map((data) => ({ model, id: data.id, version: response.cursor, data })),
  );

/** Skips writes whose row is gone or already there. */
export function applyMutations(collections: Collections<RowMap>, mutations: Entry["mutations"]): void {
  for (const m of mutations) {
    const collection = collections[m.model] as unknown as Writable;
    if (!collection) continue;
    if (m.type === "insert") {
      if (!collection.has(m.key)) collection.insert(m.value);
    } else if (collection.has(m.key)) {
      if (m.type === "delete") collection.delete(m.key);
      else collection.update(m.key, (row) => Object.assign(row, m.value));
    }
  }
}

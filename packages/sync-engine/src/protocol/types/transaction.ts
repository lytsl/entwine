/** One write of a client transaction: the full row of an insert, the changed fields of an update. */
export interface Mutation {
  model: string;
  type: "insert" | "update" | "delete";
  key: string;
  value: Record<string, unknown>;
}

/**
 * `POST /transactions`: applied all or nothing. `id` is chosen by the client; the server applies an id at most once
 * and answers a repeat with the original cursor, so a client may resend when delivery is in doubt. A `revert` asks
 * the server to undo an earlier transaction of the same member.
 */
export type TransactionRequest = { id: string; mutations: Mutation[] } | { id: string; revert: string };

/** The last change id the transaction produced: the client waits for the stream to reach it. */
export interface TransactionResponse {
  cursor: number;
}

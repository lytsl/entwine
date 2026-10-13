import type { Row } from "./schema";

/**
 * One committed row change: the whole row, or null for a delete. Ids are consecutive, in commit order. `inserted`
 * says the row did not exist before, so nothing referenced it yet.
 */
export interface Change {
  id: number;
  model: string;
  rowId: string;
  data: Row | null;
  inserted: boolean;
}

/**
 * `GET /stream?epoch=<epoch>&after=<cursor>` sends server-sent events: `changes` per commit (its `id` is the commit's
 * last change id and the reader's new position, its data the `Change[]` the reader may see, which leaves out rows
 * other members own and so may be empty), `revoked` when the member loses access, and `reset` when the server cannot
 * continue from that position: another epoch, a cursor ahead of the log, or one older than the changes it keeps.
 * `revoked` and `reset` end the stream.
 */
export type StreamEvent = { event: "changes"; changes: Change[] } | { event: "revoked" } | { event: "reset" };

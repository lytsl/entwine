import type { RowMap, Schema } from "@entwine/sync-engine/protocol";
import type { LocalStore } from "../device/local-store";
import type { SyncError } from "../errors";
import type { SessionStore } from "../types/history";
import type { Fetch } from "../types/workspace";

export interface WorkspaceOptions<R extends RowMap> {
  schema: Schema<R>;
  /** The sync endpoints' base, such as `/api/w/<workspace id>`. */
  url: string;
  fetch?: Fetch;
  /** How long the stream may stay silent, heartbeats included, before it is treated as dead. */
  stallMs?: number;
  /** Without one, the tab keeps the workspace in memory only. */
  local?: LocalStore;
  /** Where undo history is kept for the tab; it survives a reload. */
  session?: SessionStore;
  /** Called with every refused write nobody is waiting for, and with storage failures. */
  onError?(error: SyncError): void;
}

import type { RowMap } from "@entwine/sync-engine/protocol";
import type { Workspace as Open } from "../workspace/workspace";

/**
 * Declare the app's rows once, and every hook is typed by them:
 * `declare module "@entwine/db-collection/react" { interface Register { rows: Rows } }`.
 */
export interface Register {}
export type RegisteredRows = Register extends { rows: infer R extends RowMap } ? R : RowMap;

/** Writes, undo and redo report a failure through `onError` and answer false. */
export type Workspace<R extends RowMap = RegisteredRows> = Omit<Open<R>, "mutate"> & {
  workspaceId: string;
  userId: string;
  mutate(fn: () => void): Promise<boolean>;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
};

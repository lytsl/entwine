/**
 * What the write rules share. A rule validates the client's value, checks permissions and references, sets
 * server-owned fields and may write derived rows (activity).
 */

import { isAdmin as isAdminRole, type ModelName, type Role, type Row, type Rows } from "@entwine/shared";
import { type Writer as EngineWriter, WriteError } from "@entwine/sync-engine";
import { z } from "zod";
import type { WorkspaceFiles } from "../../../services/files";

export type ErrorCode = WriteError["code"];
/** Every write through it becomes a change. */
export type Writer = EngineWriter<Rows>;

export interface WriteContext {
  writer: Writer;
  userId: string;
  role: Role;
  now: number;
  /** The workspace's attachment bytes, which an `Attachment` row must have. */
  files: WorkspaceFiles;
  /** Asks for a planning pass once the transaction has committed: a project's cycle schedule changed. */
  replan?(): void;
  /** Hands a notification on, to be mailed and pushed once the transaction has committed. */
  notified?(row: Row<"Notification">): void;
  /** Inside a revert: an undo subscribes and notifies nobody. */
  quiet?: boolean;
}

export interface Rule<M extends ModelName> {
  restore?(ctx: WriteContext, row: Row<M>): Promise<unknown>;
  insert?(ctx: WriteContext, value: unknown): Promise<Row<M>>;
  /** Runs once the inserted row exists, for derived rows that reference it. */
  afterInsert?(ctx: WriteContext, row: Row<M>): Promise<void>;
  update?(ctx: WriteContext, current: Row<M>, value: unknown): Promise<Partial<Row<M>>>;
  delete?(ctx: WriteContext, current: Row<M>): Promise<void>;
}

export const fail = (code: ErrorCode, message: string): never => {
  throw new WriteError(code, message);
};

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) fail("invalid", z.prettifyError(result.error));
  return result.data as T;
}

export const isAdmin = (ctx: WriteContext) => isAdminRole(ctx.role);

/** Only the fields that differ, so an update that changes nothing writes nothing. */
export function changed<T extends object>(current: T, patch: Partial<T>): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(patch) as [keyof T, T[keyof T]][]) {
    if (value !== undefined && current[key] !== value) result[key] = value;
  }
  return result;
}

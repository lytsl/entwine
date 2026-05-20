import type { NonNullableFields } from "@entwine/utility/types";
import type { ZodType } from "zod";
import type { InferInsertModel, SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { auth } from "@/auth/better-auth";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "../drizzle-arktype";
import type { drizzle } from "drizzle-orm/bun-sqlite";

import { configure } from "arktype/config";
configure({ onUndeclaredKey: "delete" });

type Session = NonNullableFields<typeof auth.$Infer.Session>;

// ({
//    type: "insert";
//    data: any[];
// } | {
//    type: "update";
//    data: any;
//    ids: string[];
// } | {
//    type: "delete";
//    ids: string[];
// })

export type CreatePayload<T extends SQLiteTable> = {
  type: "insert";
  data: InferInsertModel<T>[];
};
export type UpdatePayload<T extends SQLiteTable> = {
  type: "update";
  data: Partial<InferInsertModel<T>>[];
  ids: string[];
};
export type DeletePayload = { type: "delete"; ids: string[] };

type HookFn<Ctx> = (ctx: Ctx) => void | Promise<void>;
type SyncHookFn<Ctx> = (ctx: Ctx) => void;

interface BaseHooks<T extends SQLiteTable> {
  beforeInsert: HookFn<{
    session: Session;
    payload: CreatePayload<T>;
    db: ReturnType<typeof drizzle>;
  }>;
  afterInsert: HookFn<{
    session: Session;
    payload: CreatePayload<T>;
    db: ReturnType<typeof drizzle>;
    result: any;
  }>;

  beforeUpdate: HookFn<{
    session: Session;
    payload: UpdatePayload<T>;
    db: ReturnType<typeof drizzle>;
  }>;
  afterUpdate: HookFn<{
    session: Session;
    payload: UpdatePayload<T>;
    db: ReturnType<typeof drizzle>;
    result: any;
  }>;

  beforeDelete: HookFn<{
    session: Session;
    payload: DeletePayload;
    db: ReturnType<typeof drizzle>;
  }>;
  afterDelete: HookFn<{
    session: Session;
    payload: DeletePayload;
    db: ReturnType<typeof drizzle>;
    result: any;
  }>;
}

type ToTxHook<F> = F extends (ctx: infer Ctx) => any
  ? SyncHookFn<Omit<Ctx, "db"> & { tx: ReturnType<typeof drizzle> }>
  : never;

export type ModelHooks<T extends SQLiteTable> = {
  [K in keyof BaseHooks<T>]?: BaseHooks<T>[K];
} & {
  [K in keyof BaseHooks<T> as `tx${Capitalize<K & string>}`]?: ToTxHook<
    BaseHooks<T>[K]
  >;
};

export interface ModelOptions<T extends SQLiteTable> {
  filters?: (session: Session) => SQL<unknown> | undefined;
  hooks?: ModelHooks<T>;
}

export interface ModelConfigReturn<TTable extends SQLiteTable> {
  table: TTable;
  schema: {
    insert: ZodType;
    update: ZodType;
    select: ZodType;
  };
  filters?: ModelOptions<TTable>["filters"];
  hooks?: ModelOptions<TTable>["hooks"];
}

export function defineModelConfig<TTable extends SQLiteTable>(
  table: TTable,
  options?: ModelOptions<TTable>,
): ModelConfigReturn<TTable> {
  return {
    table,
    schema: {
      insert: createInsertSchema(table),
      update: createUpdateSchema(table),
      select: createSelectSchema(table),
    },
    filters: options?.filters,
    hooks: options?.hooks,
  };
}

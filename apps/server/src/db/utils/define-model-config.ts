import type { NonNullableFields } from "@entwine/utility/types";
import type { Type } from "arktype";
import type { InferInsertModel, SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { auth } from "@/auth/better-auth";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "../drizzle-arktype";
import type { drizzle } from "drizzle-orm/bun-sqlite";

type Session = NonNullableFields<typeof auth.$Infer.Session>;

export type CreatePayload<T extends SQLiteTable> = {
	data: InferInsertModel<T>;
}[];
export type UpdatePayload<T extends SQLiteTable> = {
	id: string;
	data: Partial<InferInsertModel<T>>;
}[];
export type DeletePayload = { id: string }[];

type HookFn<Ctx> = (ctx: Ctx) => void | Promise<void>;
type SyncHookFn<Ctx> = (ctx: Ctx) => void;

interface BaseHooks<T extends SQLiteTable> {
	beforeCreate: HookFn<{
		session: Session;
		payload: CreatePayload<T>;
		db: ReturnType<typeof drizzle>;
	}>;
	afterCreate: HookFn<{
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
		insert: Type;
		update: Type;
		select: Type;
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

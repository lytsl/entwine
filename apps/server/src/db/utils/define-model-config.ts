import type { NonNullableFields } from "@entwine/utility/types";
import { type as arktype, type Type } from "arktype";
import type { InferInsertModel, SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { auth } from "@/auth/better-auth";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "../drizzle-arktype";

type Session = NonNullableFields<typeof auth.$Infer.Session>;

export type CreatePayload<T extends SQLiteTable> = {
	data: InferInsertModel<T>;
}[];
export type UpdatePayload<T extends SQLiteTable> = {
	id: string;
	data: Partial<InferInsertModel<T>>;
}[];
export type DeletePayload = { id: string }[];

export interface ModelHooks<T extends SQLiteTable> {
	beforeCreate?: (ctx: {
		session: Session;
		payload: CreatePayload<T>;
	}) => void | Promise<void>;
	afterCreate?: (ctx: {
		session: Session;
		payload: CreatePayload<T>;
		result: any;
	}) => void | Promise<void>;

	beforeUpdate?: (ctx: {
		session: Session;
		payload: UpdatePayload<T>;
	}) => void | Promise<void>;
	afterUpdate?: (ctx: {
		session: Session;
		payload: UpdatePayload<T>;
		result: any;
	}) => void | Promise<void>;

	beforeDelete?: (ctx: {
		session: Session;
		payload: DeletePayload;
	}) => void | Promise<void>;
	afterDelete?: (ctx: {
		session: Session;
		payload: DeletePayload;
		result: any;
	}) => void | Promise<void>;
}

export interface ModelOptions<T extends SQLiteTable> {
	filters?: (session: Session) => SQL<unknown> | undefined;
	hooks?: ModelHooks<T>;
}

// Single factory function
export function defineModelConfig<TTable extends SQLiteTable>(
	table: TTable,
	options?: ModelOptions<TTable>,
) {
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

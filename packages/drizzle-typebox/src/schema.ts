import "./extend-drizzle";
import type { TSchema } from "@entwine/typebox";
import { Type as t } from "@entwine/typebox";
import type { Table, View } from "drizzle-orm";
import {
	Column,
	getTableColumns,
	getViewSelectedFields,
	is,
	isTable,
	isView,
	SQL,
} from "drizzle-orm";
import type { PgEnum } from "drizzle-orm/pg-core";
import { columnToSchema, mapEnumValues } from "./column";
import type { Conditions } from "./schema.types.internal.ts";
import type {
	CreateInsertSchema,
	CreateSchemaFactoryOptions,
	CreateSelectSchema,
	CreateUpdateSchema,
} from "./schema.types.ts";
import { isPgEnum } from "./utils";

export function getColumns(tableLike: Table | View) {
	return isTable(tableLike)
		? getTableColumns(tableLike)
		: getViewSelectedFields(tableLike);
}

export function handleColumns(
	columns: Record<string, any>,
	conditions: Conditions,
	factory?: CreateSchemaFactoryOptions,
): TSchema {
	const columnSchemas: Record<string, TSchema> = {};

	for (const [key, selected] of Object.entries(columns)) {
		if (
			!is(selected, Column) &&
			!is(selected, SQL) &&
			!is(selected, SQL.Aliased) &&
			typeof selected === "object"
		) {
			const columns =
				isTable(selected) || isView(selected) ? getColumns(selected) : selected;
			columnSchemas[key] = handleColumns(columns, conditions, factory);
			continue;
		}

		const refinement = selected.config?.typebox;
		if (refinement !== undefined && typeof refinement !== "function") {
			columnSchemas[key] = refinement;
			continue;
		}

		const column = is(selected, Column) ? selected : undefined;
		const schema = column
			? columnToSchema(column, factory?.typeboxInstance ?? t)
			: t.Any();
		const refined =
			typeof refinement === "function" ? refinement(schema) : schema;

		if (conditions.never(column)) {
			continue;
		}
		columnSchemas[key] = refined;

		if (column) {
			if (conditions.nullable(column)) {
				columnSchemas[key] = t.Union([columnSchemas[key]!, t.Null()]);
			}

			if (conditions.optional(column)) {
				columnSchemas[key] = t.Optional(columnSchemas[key]!);
			}
		}
	}

	return t.Object(columnSchemas) as any;
}

export function handleEnum(
	enum_: PgEnum<any>,
	factory?: CreateSchemaFactoryOptions,
) {
	const typebox: typeof t = factory?.typeboxInstance ?? t;
	return typebox.Enum(mapEnumValues(enum_.enumValues));
}

const selectConditions: Conditions = {
	never: () => false,
	optional: () => false,
	nullable: (column) => !column.notNull,
};

const insertConditions: Conditions = {
	never: (column) =>
		column?.generated?.type === "always" ||
		column?.generatedIdentity?.type === "always",
	optional: (column) =>
		!column.notNull || (column.notNull && column.hasDefault),
	nullable: (column) => !column.notNull,
};

const updateConditions: Conditions = {
	never: (column) =>
		column?.generated?.type === "always" ||
		column?.generatedIdentity?.type === "always",
	optional: () => true,
	nullable: (column) => !column.notNull,
};

export const createSelectSchema: CreateSelectSchema = (
	entity: Table | View | PgEnum<[string, ...string[]]>,
) => {
	if (isPgEnum(entity)) {
		return handleEnum(entity);
	}
	const columns = getColumns(entity);
	return handleColumns(columns, selectConditions) as any;
};

export const createInsertSchema: CreateInsertSchema = (entity: Table) => {
	const columns = getColumns(entity);
	return handleColumns(columns, insertConditions) as any;
};

export const createUpdateSchema: CreateUpdateSchema = (entity: Table) => {
	const columns = getColumns(entity);
	return handleColumns(columns, updateConditions) as any;
};

export function createSchemaFactory(options?: CreateSchemaFactoryOptions) {
	const createSelectSchema: CreateSelectSchema = (
		entity: Table | View | PgEnum<[string, ...string[]]>,
	) => {
		if (isPgEnum(entity)) {
			return handleEnum(entity, options);
		}
		const columns = getColumns(entity);
		return handleColumns(columns, selectConditions, options) as any;
	};

	const createInsertSchema: CreateInsertSchema = (entity: Table) => {
		const columns = getColumns(entity);
		return handleColumns(columns, insertConditions, options) as any;
	};

	const createUpdateSchema: CreateUpdateSchema = (entity: Table) => {
		const columns = getColumns(entity);
		return handleColumns(columns, updateConditions, options) as any;
	};

	return { createSelectSchema, createInsertSchema, createUpdateSchema };
}

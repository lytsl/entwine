/** biome-ignore-all lint/suspicious/noExplicitAny: taken from drizzle-arktype */
/** biome-ignore-all lint/style/noNonNullAssertion: taken from drizzle-arktype */
import { type Type, type } from "arktype";
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
import { columnToSchema } from "./column";
import type {
	CreateInsertSchema,
	CreateSelectSchema,
	CreateUpdateSchema,
} from "./schema.types";
import type { Conditions } from "./schema.types.internal";
import { isPgEnum } from "./utils";

function getColumns(tableLike: Table | View) {
	return isTable(tableLike)
		? getTableColumns(tableLike)
		: getViewSelectedFields(tableLike);
}

function handleColumns(
	columns: Record<string, any>,
	conditions: Conditions,
): Type {
	const columnSchemas: Record<string, Type> = {};

	for (const [key, selected] of Object.entries(columns)) {
		if (
			!is(selected, Column) &&
			!is(selected, SQL) &&
			!is(selected, SQL.Aliased) &&
			typeof selected === "object"
		) {
			const columns =
				isTable(selected) || isView(selected) ? getColumns(selected) : selected;
			columnSchemas[key] = handleColumns(columns, conditions);
			continue;
		}

		const refinement = selected?.config?.arktype;
		const column = is(selected, Column) ? selected : undefined;
		if (
			refinement !== undefined &&
			(typeof refinement !== "function" ||
				(typeof refinement === "function" &&
					refinement.expression !== undefined))
		) {
			columnSchemas[key] = refinement;
		} else {
			const schema = column ? columnToSchema(column) : type.unknown;
			const refined =
				typeof refinement === "function" ? refinement(schema) : schema;

			if (conditions.never(column)) {
				continue;
			}
			columnSchemas[key] = refined;
		}

		if (column) {
			if (conditions.nullable(column)) {
				columnSchemas[key] = columnSchemas[key]!.or(type.null);
			}

			if (conditions.optional(column)) {
				columnSchemas[key] = columnSchemas[key]!.optional() as any;
			}
		}
	}

	return type(columnSchemas);
}

export const createSelectSchema = ((
	entity: Table | View | PgEnum<[string, ...string[]]>,
) => {
	if (isPgEnum(entity)) {
		return type.enumerated(...entity.enumValues);
	}
	const columns = getColumns(entity);
	return handleColumns(columns, {
		never: () => false,
		optional: () => false,
		nullable: (column) => !column.notNull,
	}) as any;
}) as CreateSelectSchema;

export const createInsertSchema = ((entity: Table) => {
	const columns = getColumns(entity);
	return handleColumns(columns, {
		never: (column) =>
			column?.generated?.type === "always" ||
			column?.generatedIdentity?.type === "always",
		optional: (column) =>
			!column.notNull || (column.notNull && column.hasDefault),
		nullable: (column) => !column.notNull,
	}) as any;
}) as CreateInsertSchema;

export const createUpdateSchema = ((entity: Table) => {
	const columns = getColumns(entity);
	return handleColumns(columns, {
		never: (column) =>
			column?.generated?.type === "always" ||
			column?.generatedIdentity?.type === "always",
		optional: () => true,
		nullable: (column) => !column.notNull,
	}) as any;
}) as CreateUpdateSchema;

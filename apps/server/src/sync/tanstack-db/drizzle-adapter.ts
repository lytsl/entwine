import { type } from "arktype";
import {
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNull,
	like,
	lt,
	lte,
	not,
	type SQL,
	sql,
} from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { ParsedLoadSubsetOptionsType } from "./types";

// Helper: Safely resolve flat columns or nested JSON paths
function resolveField(
	table: SQLiteTable,
	fieldPath: Array<string | number>,
): SQL | any {
	if (!fieldPath || fieldPath.length === 0) return undefined;

	const rootColumn = (table as any)[fieldPath[0]!];
	if (!rootColumn) return undefined;

	// Flat column
	if (fieldPath.length === 1) return rootColumn;

	// Nested JSON path mapping using Postgres ->>
	const pathParts = fieldPath.slice(1);
	const jsonPath = pathParts
		.map((p) => (typeof p === "number" ? `${p}` : `'${p}'`))
		.join("->>");
	return sql`${rootColumn}->>${sql.raw(jsonPath)}`;
}

// Helper: Recursively unwrap 'not_' prefixes
function parseOperator(operatorStr: string): {
	baseOperator: string;
	isNot: boolean;
} {
	let isNot = false;
	let baseOperator = operatorStr;

	while (baseOperator.startsWith("not_")) {
		isNot = !isNot;
		baseOperator = baseOperator.slice(4);
	}

	// Handle a standalone 'not'
	if (baseOperator === "not") {
		isNot = !isNot;
		baseOperator = "eq";
	}

	return { baseOperator, isNot };
}

// --- MAIN FUNCTION ---
export function parseTanstackOptions(
	table: SQLiteTable,
	options: ParsedLoadSubsetOptionsType,
) {
	const where: SQL[] = [];
	const orderBy: SQL[] = [];

	// ==========================================
	// 1. Process Array of Filters
	// ==========================================
	if (Array.isArray(options.filters)) {
		for (const filter of options.filters) {
			const columnRef = resolveField(table, filter.field);
			if (!columnRef) continue;

			const { baseOperator, isNot } = parseOperator(filter.operator);
			let condition: SQL | undefined;

			switch (baseOperator) {
				// Standard
				case "eq":
					condition = eq(columnRef, filter.value);
					break;
				case "gt":
					condition = gt(columnRef, filter.value);
					break;
				case "gte":
					condition = gte(columnRef, filter.value);
					break;
				case "lt":
					condition = lt(columnRef, filter.value);
					break;
				case "lte":
					condition = lte(columnRef, filter.value);
					break;
				case "in":
				case "inArray":
					condition = inArray(
						columnRef,
						type("unknown[]").assert(filter.value),
					);
					break;
				case "like":
					condition = like(columnRef, type("string").assert(filter.value));
					break;
				case "ilike":
					condition = ilike(columnRef, type("string").assert(filter.value));
					break;

				// Nulls
				case "isNull":
				case "isUndefined":
					condition = isNull(columnRef);
					break;

				// Functions
				case "upper":
					condition = eq(sql`UPPER(${columnRef})`, filter.value);
					break;
				case "lower":
					condition = eq(sql`LOWER(${columnRef})`, filter.value);
					break;
				case "length":
					condition = eq(sql`LENGTH(${columnRef})`, filter.value);
					break;
				case "concat":
					condition = eq(
						sql`CONCAT(${columnRef}, ${filter.value})`,
						filter.value,
					);
					break;
				case "add":
					condition = eq(sql`${columnRef} + ${filter.value}`, filter.value);
					break;
				case "coalesce":
					condition = eq(
						sql`COALESCE(${columnRef}, ${filter.value})`,
						filter.value,
					);
					break;

				// Aggregates
				case "count":
					condition = eq(sql`COUNT(${columnRef})`, filter.value);
					break;
				case "avg":
					condition = eq(sql`AVG(${columnRef})`, filter.value);
					break;
				case "sum":
					condition = eq(sql`SUM(${columnRef})`, filter.value);
					break;
				case "min":
					condition = eq(sql`MIN(${columnRef})`, filter.value);
					break;
				case "max":
					condition = eq(sql`MAX(${columnRef})`, filter.value);
					break;

				case "and":
				case "or":
					// In a flat SimpleComparison array, logical operators shouldn't appear as bases,
					// but if they do, we log and skip to prevent malformed SQL.
					console.warn(
						`Encountered unhandled logical base operator: ${baseOperator}`,
					);
					break;

				default:
					console.warn(`Unmapped TanStack operator: ${baseOperator}`);
			}

			if (condition) {
				where.push(isNot ? not(condition) : condition);
			}
		}
	}

	// ==========================================
	// 2. Process Array of Sorts
	// ==========================================
	if (Array.isArray(options.sorts)) {
		for (const sort of options.sorts) {
			const columnRef = resolveField(table, sort.field);
			if (!columnRef) continue;

			const direction = sort.direction === "desc" ? "DESC" : "ASC";
			const nulls = sort.nulls === "first" ? "NULLS FIRST" : "NULLS LAST";

			let collation = "";
			if (sort.stringSort === "locale" && sort.locale) {
				collation = `COLLATE "${sort.locale}"`;
			}

			orderBy.push(
				sql`${columnRef} ${sql.raw(direction)} ${sql.raw(nulls)} ${sql.raw(collation)}`,
			);
		}
	}

	return {
		where,
		orderBy,
		limit: options.limit,
		offset: options.offset,
	};
}

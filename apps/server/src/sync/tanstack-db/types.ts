import { type } from "arktype";

export const FieldPath = type("(number | string)[]");
export const SimpleComparison = type({
	field: FieldPath,
	operator: "string",
	value: "unknown",
});
export const ParsedOrderBy = type({
	field: FieldPath,
	direction: "'asc' | 'desc'",
	nulls: "'first' | 'last'",
	/** String sorting method: 'lexical' (default) or 'locale' (locale-aware) */
	stringSort: "'lexical' | 'locale'",
	/** Locale for locale-aware string sorting (e.g., 'en-US') */
	locale: "string",
	/** Additional options for locale-aware sorting */
	localeOptions: "object",
});
export const ParsedLoadSubsetOptions = type({
	/**
	 * NOT operators are flattened by prefixing the operator name (e.g., `not(eq(...))` becomes `not_eq`).
	 *
	 * @example
	 * ```typescript
	 * // [
	 * // { field: ['category'], operator: 'eq', value: 'electronics' },
	 * // { field: ['price'], operator: 'lt', value: 100 },
	 * // { field: ['email'], operator: 'isNull' }, // No value for null checks
	 * // { field: ['status'], operator: 'not_eq', value: 'archived' }
	 * // ]
	 * ```
	 */
	filters: SimpleComparison.array(),
	/**
	 *
	 * @example
	 * ```typescript
	 * // [
	 * // { field: ['category'], direction: 'asc', nulls: 'last' },
	 * // { field: ['price'], direction: 'desc', nulls: 'last' }
	 * // ]
	 * ```
	 */
	sorts: ParsedOrderBy.array(),

	limit: "number",

	offset: "number",
}).partial();

export type ParsedLoadSubsetOptionsType =
	typeof ParsedLoadSubsetOptions.inferOut;

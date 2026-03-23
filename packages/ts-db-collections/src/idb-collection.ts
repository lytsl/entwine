import {
	type Collection,
	createCollection,
	type IR,
	type LoadSubsetOptions,
	type ParsedOrderBy,
	parseOrderByExpression,
} from "@tanstack/db";
import { type IDBPDatabase, openDB } from "idb";

type BasicExpression<T = any> = IR.BasicExpression<T>;

function getNestedValue(obj: any, path: Array<string | number>): any {
	let current = obj;
	for (const key of path) {
		if (current == null) return undefined;
		current = current[key];
	}
	return current;
}

function matchesFilter(
	item: any,
	filter: { field: Array<string | number>; operator: string; value?: any },
): boolean {
	const fieldValue = getNestedValue(item, filter.field);
	switch (filter.operator) {
		case "eq":
			return fieldValue === filter.value;
		case "ne":
		case "notEq":
			return fieldValue !== filter.value;
		case "gt":
			return (fieldValue as any) > filter.value;
		case "gte":
			return (fieldValue as any) >= filter.value;
		case "lt":
			return (fieldValue as any) < filter.value;
		case "lte":
			return (fieldValue as any) <= filter.value;
		case "in":
			return Array.isArray(filter.value) && filter.value.includes(fieldValue);
		case "notIn":
			return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
		case "like": {
			if (typeof fieldValue !== "string" || typeof filter.value !== "string")
				return false;
			const likePattern = filter.value.replace(/%/g, ".*").replace(/_/g, ".");
			return new RegExp(`^${likePattern}$`, "i").test(fieldValue);
		}
		case "ilike": {
			if (typeof fieldValue !== "string" || typeof filter.value !== "string")
				return false;
			const ilikePattern = filter.value.replace(/%/g, ".*").replace(/_/g, ".");
			return new RegExp(`^${ilikePattern}$`, "").test(fieldValue);
		}
		case "isNull":
			return fieldValue === null || fieldValue === undefined;
		case "isNotNull":
			return fieldValue !== null && fieldValue !== undefined;
		case "isUndefined":
			return fieldValue === undefined;
		case "isNotUndefined":
			return fieldValue !== undefined;
		case "upper":
			return (
				String(fieldValue).toUpperCase() === String(filter.value).toUpperCase()
			);
		case "lower":
			return (
				String(fieldValue).toLowerCase() === String(filter.value).toLowerCase()
			);
		case "length":
			return fieldValue != null && String(fieldValue).length === filter.value;
		default:
			return true;
	}
}

function matchesWhereExpression(
	item: any,
	expr: BasicExpression<boolean> | undefined,
): boolean {
	if (!expr) return true;

	const node = expr as any;
	if (node.type === "value") {
		return node.value === true;
	}

	if (node.type === "func") {
		const funcName = node.name;

		if (funcName === "and") {
			return node.args.every((arg: BasicExpression<boolean>) =>
				matchesWhereExpression(item, arg),
			);
		}

		if (funcName === "or") {
			return node.args.some((arg: BasicExpression<boolean>) =>
				matchesWhereExpression(item, arg),
			);
		}

		if (funcName === "not") {
			return !matchesWhereExpression(item, node.args[0]);
		}

		if (
			funcName === "eq" ||
			funcName === "ne" ||
			funcName === "gt" ||
			funcName === "gte" ||
			funcName === "lt" ||
			funcName === "lte"
		) {
			const fieldExpr = node.args[0] as BasicExpression;
			const valueExpr = node.args[1] as BasicExpression;

			const fieldNode = fieldExpr as any;
			let fieldPath: Array<string | number> = [];
			if (fieldNode.type === "prop") {
				fieldPath = fieldNode.path;
			}

			const valueNode = valueExpr as any;
			let value: any = valueNode.value;
			if (valueNode.type === "prop") {
				value = getNestedValue(item, valueNode.path);
			}

			return matchesFilter(
				{ field: fieldPath, operator: funcName, value },
				{ field: fieldPath, operator: funcName, value },
			);
		}

		if (funcName === "inArray") {
			const fieldExpr = node.args[0] as BasicExpression;
			const arrayExpr = node.args[1] as BasicExpression;

			const fieldNode = fieldExpr as any;
			let fieldPath: Array<string | number> = [];
			if (fieldNode.type === "prop") {
				fieldPath = fieldNode.path;
			}

			const arrayNode = arrayExpr as any;
			const value = arrayNode.type === "value" ? arrayNode.value : undefined;

			return matchesFilter(
				{ field: fieldPath, operator: "in", value },
				{ field: fieldPath, operator: "in", value },
			);
		}

		if (funcName === "like" || funcName === "ilike") {
			const fieldExpr = node.args[0] as BasicExpression;
			const valueExpr = node.args[1] as BasicExpression;

			const fieldNode = fieldExpr as any;
			let fieldPath: Array<string | number> = [];
			if (fieldNode.type === "prop") {
				fieldPath = fieldNode.path;
			}

			const valueNode = valueExpr as any;
			const value = valueNode.type === "value" ? valueNode.value : undefined;

			return matchesFilter(
				{ field: fieldPath, operator: funcName, value },
				{ field: fieldPath, operator: funcName, value },
			);
		}

		if (
			funcName === "isNull" ||
			funcName === "isUndefined" ||
			funcName === "isNotNull" ||
			funcName === "isNotUndefined"
		) {
			const fieldExpr = node.args[0] as BasicExpression;
			const fieldNode = fieldExpr as any;
			let fieldPath: Array<string | number> = [];
			if (fieldNode.type === "prop") {
				fieldPath = fieldNode.path;
			}

			return matchesFilter(
				{ field: fieldPath, operator: funcName },
				{ field: fieldPath, operator: funcName },
			);
		}
	}

	return true;
}

function sortItems<T>(items: T[], sorts: ParsedOrderBy[]): T[] {
	if (sorts.length === 0) return items;

	return [...items].sort((a, b) => {
		for (const sort of sorts) {
			const aValue = getNestedValue(a, sort.field);
			const bValue = getNestedValue(b, sort.field);

			let comparison = 0;
			if (aValue === bValue) continue;
			if (aValue == null) comparison = 1;
			else if (bValue == null) comparison = -1;
			else if (typeof aValue === "string" && typeof bValue === "string") {
				comparison = aValue.localeCompare(bValue, sort.locale, {
					sensitivity: sort.stringSort === "locale" ? "variant" : "base",
				});
			} else {
				comparison = (aValue as any) < bValue ? -1 : 1;
			}

			if (comparison !== 0) {
				return sort.direction === "desc" ? -comparison : comparison;
			}
		}
		return 0;
	});
}

export interface IndexedDBCollectionConfig<
	T extends object,
	TKey extends string | number = string | number,
> {
	name: string;
	storeName: string;
	dbVersion?: number;
	getKey: (item: T) => TKey;
	parse?: (item: any) => T;
	serialize?: (item: T) => any;
}

export interface IDBCollectionOptions<
	T extends object,
	TKey extends string | number = string | number,
> {
	db: IDBPDatabase;
	storeName: string;
	getKey: (item: T) => TKey;
	parse?: (item: any) => T;
	serialize?: (item: T) => any;
}

function createLoadSubset<T extends object>(
	db: IDBPDatabase,
	storeName: string,
	parse: (item: any) => T,
): (options: LoadSubsetOptions) => true | Promise<void> {
	return async (options: LoadSubsetOptions) => {
		const { where, orderBy, limit, offset, cursor } = options;

		const tx = db.transaction(storeName, "readonly");
		const store = tx.objectStore(storeName);

		let items = await store.getAll();

		items = items.map(parse);

		if (where) {
			items = items.filter((item) => matchesWhereExpression(item, where));
		}

		const sorts = parseOrderByExpression(orderBy ?? null);
		items = sortItems(items, sorts);

		if (cursor && sorts.length > 0) {
			const firstSort = sorts[0];
			if (!firstSort) return;
			const cursorField = firstSort.field;
			const cursorValue = (cursor as any)[cursorField.join(".")];
			if (cursorValue !== undefined) {
				items = items.filter((item) => {
					const itemValue = getNestedValue(item, firstSort.field);
					if (firstSort.direction === "asc") {
						return (itemValue as any) > cursorValue;
					}
					return (itemValue as any) < cursorValue;
				});
			}
		}

		const startOffset = offset ?? 0;
		if (limit !== undefined) {
			items = items.slice(startOffset, startOffset + limit);
		} else {
			items = items.slice(startOffset);
		}

		return;
	};
}

export function createIDBCollection<
	T extends object,
	TKey extends string | number,
>(options: IDBCollectionOptions<T, TKey>): Collection<T, TKey> {
	const { db, storeName, getKey, parse, serialize } = options;

	const defaultParse = (item: any): T => item as T;
	const defaultSerialize = (item: T): any => item;

	const parseItem = parse ?? defaultParse;
	const serializeItem = serialize ?? defaultSerialize;

	const loadSubset = createLoadSubset(db, storeName, parseItem);

	const collection = createCollection<T, TKey>({
		id: storeName,
		getKey,
		sync: {
			sync: () => {
				return {
					loadSubset,
				};
			},
		},
		onInsert: async ({ transaction }) => {
			const tx = db.transaction(storeName, "readwrite");
			const store = tx.objectStore(storeName);

			for (const mutation of transaction.mutations) {
				const serialized = serializeItem(mutation.modified);
				await store.put(serialized);
			}

			await tx.done;
		},
		onUpdate: async ({ transaction }) => {
			const tx = db.transaction(storeName, "readwrite");
			const store = tx.objectStore(storeName);

			for (const mutation of transaction.mutations) {
				const serialized = serializeItem(mutation.modified);
				await store.put(serialized);
			}

			await tx.done;
		},
		onDelete: async ({ transaction }) => {
			const tx = db.transaction(storeName, "readwrite");
			const store = tx.objectStore(storeName);

			for (const mutation of transaction.mutations) {
				await store.delete(mutation.key);
			}

			await tx.done;
		},
	});

	return collection;
}

export async function openIDB<T extends object, TKey extends string | number>(
	config: IndexedDBCollectionConfig<T, TKey>,
): Promise<Collection<T, TKey>> {
	const { name, storeName, dbVersion = 1, getKey, parse, serialize } = config;

	const db = await openDB(name, dbVersion, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(storeName)) {
				db.createObjectStore(storeName, { keyPath: "id" });
			}
		},
	});

	return createIDBCollection({ db, storeName, getKey, parse, serialize });
}

export { createCollection };
export type { Collection };

/** biome-ignore-all lint/suspicious/noThenProperty: idb wrapper */
import {
	type DBSchema,
	type IDBPDatabase,
	type OpenDBCallbacks,
	openDB,
} from "idb";
import type { z } from "zod";

// Re-export everything from idb so users have full access to types
export type { DBSchema, IDBPDatabase, OpenDBCallbacks } from "idb";
export { deleteDB, unwrap, wrap } from "idb";

// ── Zod Schema Definitions ────────────────────────────────────────────

export interface ZodIndexDef<T> {
	keyPath: keyof T | string; // string fallback for nested 'a.b'
	unique?: boolean;
	multiEntry?: boolean;
}

export interface ZodStoreDef<T extends z.ZodTypeAny = any> {
	schema: T;
	keyPath?: keyof z.infer<T> | string;
	autoIncrement?: boolean;
	indexes?: Record<string, ZodIndexDef<z.infer<T>>>;
}

export type ZodDBSchemaDef = Record<string, ZodStoreDef>;

export type ExtractZodSchemas<T extends ZodDBSchemaDef> = {
	[K in keyof T]: z.infer<T[K]["schema"]>;
};

// ── Type Inference Magic ──────────────────────────────────────────────

/**
 * Dynamically extracts the exact DBSchema shape required by `idb`
 * directly from your Zod runtime definitions.
 */
export type InferDBSchema<S extends ZodDBSchemaDef> = {
	[StoreName in keyof S]: {
		key: S[StoreName]["keyPath"] extends keyof z.infer<S[StoreName]["schema"]>
			? z.infer<S[StoreName]["schema"]>[S[StoreName]["keyPath"]]
			: S[StoreName]["autoIncrement"] extends true
				? number
				: IDBValidKey;
		value: z.infer<S[StoreName]["schema"]>;
		indexes: S[StoreName]["indexes"] extends Record<string, any>
			? {
					[IndexName in keyof S[StoreName]["indexes"]]: S[StoreName]["indexes"][IndexName]["keyPath"] extends keyof z.infer<
						S[StoreName]["schema"]
					>
						? z.infer<
								S[StoreName]["schema"]
							>[S[StoreName]["indexes"][IndexName]["keyPath"]]
						: IDBValidKey;
				}
			: {};
	};
} & DBSchema;

/** Identity function to enforce strict type inference on your schema object */
export function defineIDBSchema<T extends ZodDBSchemaDef>(schema: T): T {
	return schema;
}

// ── Database Configuration ────────────────────────────────────────────

export interface DatabaseSchema<T extends ZodDBSchemaDef> {
	stores: T;
	/** Called after stores/indexes are created during upgrade. */
	onUpgrade?: OpenDBCallbacks<InferDBSchema<T>>["upgrade"];
	blocked?: OpenDBCallbacks<InferDBSchema<T>>["blocked"];
	blocking?: OpenDBCallbacks<InferDBSchema<T>>["blocking"];
	terminated?: OpenDBCallbacks<InferDBSchema<T>>["terminated"];
}

export type LazyIDB<DBTypes extends DBSchema | unknown = unknown> =
	IDBPDatabase<DBTypes> & {
		readonly __dbPromise: Promise<IDBPDatabase<DBTypes>>;
		readonly __initialized: boolean;
		readonly then: undefined;
	};

export function createLazyIDB<T extends ZodDBSchemaDef>(
	name: string,
	version: number,
	schema: DatabaseSchema<T>,
) {
	return openDB<InferDBSchema<T>>(name, version, {
		upgrade(db, oldVersion, newVersion, transaction, event) {
			const existingStores = new Set<string>(
				db.objectStoreNames as unknown as Iterable<string>,
			);

			for (const [storeName, storeDef] of Object.entries(schema.stores)) {
				let store:
					| ReturnType<typeof db.createObjectStore>
					| ReturnType<typeof transaction.objectStore>;

				if (!existingStores.has(storeName)) {
					store = db.createObjectStore(storeName as any, {
						keyPath: storeDef.keyPath as string | string[],
						autoIncrement: storeDef.autoIncrement,
					});
				} else {
					store = transaction.objectStore(storeName as any);
				}

				// Adjusted to loop over the Record structure instead of an Array
				for (const [idxName, idxDef] of Object.entries(
					storeDef.indexes ?? {},
				)) {
					if (!store.indexNames.contains(idxName as any)) {
						(store as any).createIndex(idxName, idxDef.keyPath, {
							unique: idxDef.unique,
							multiEntry: idxDef.multiEntry,
						});
					}
				}
			}

			schema.onUpgrade?.(db, oldVersion, newVersion, transaction, event);
		},
		blocked: schema.blocked,
		blocking: schema.blocking,
		terminated: schema.terminated,
	});

	// // Note how LazyIDB now infers the DBTypes automatically via InferDBSchema<T>
	// let dbPromise: Promise<IDBPDatabase<InferDBSchema<T>>> | null = null;
	// let initialized = false;

	// function ensureDB(): Promise<IDBPDatabase<InferDBSchema<T>>> {
	//   if (dbPromise) return dbPromise;

	//   initialized = true;
	//   dbPromise = openDB<InferDBSchema<T>>(name, version, {
	//     upgrade(db, oldVersion, newVersion, transaction, event) {
	//       const existingStores = new Set<string>(
	//         db.objectStoreNames as unknown as Iterable<string>,
	//       );

	//       debugger;
	//       for (const [storeName, storeDef] of Object.entries(schema.stores)) {
	//         let store:
	//           | ReturnType<typeof db.createObjectStore>
	//           | ReturnType<typeof transaction.objectStore>;

	//         if (!existingStores.has(storeName)) {
	//           store = db.createObjectStore(storeName as any, {
	//             keyPath: storeDef.keyPath as string | string[],
	//             autoIncrement: storeDef.autoIncrement,
	//           });
	//         } else {
	//           store = transaction.objectStore(storeName as any);
	//         }

	//         // Adjusted to loop over the Record structure instead of an Array
	//         for (const [idxName, idxDef] of Object.entries(
	//           storeDef.indexes ?? {},
	//         )) {
	//           if (!store.indexNames.contains(idxName as any)) {
	//             (store as any).createIndex(idxName, idxDef.keyPath, {
	//               unique: idxDef.unique,
	//               multiEntry: idxDef.multiEntry,
	//             });
	//           }
	//         }
	//       }

	//       schema.onUpgrade?.(db, oldVersion, newVersion, transaction, event);
	//     },
	//     blocked: schema.blocked,
	//     blocking: schema.blocking,
	//     terminated: schema.terminated,
	//   });

	//   return dbPromise;
	// }

	// const target = Object.create(null) as IDBPDatabase<InferDBSchema<T>>;

	// const proxy = new Proxy(target, {
	//   get(_target, prop, _receiver) {
	//     debugger;

	//     if (prop === "__dbPromise") return ensureDB();
	//     if (prop === "__initialized") return initialized;
	//     if (prop === "then") return undefined;

	//     const dbP = ensureDB();

	//     const asyncFn = async (...args: unknown[]) => {
	//       const db = await dbP;
	//       const val = (db as any)[prop];
	//       if (typeof val === "function") {
	//         return val.apply(db, args);
	//       }
	//       return val;
	//     };

	//     asyncFn.then = (
	//       onFulfilled?: (v: unknown) => unknown,
	//       onRejected?: (e: unknown) => unknown,
	//     ) => {
	//       const p = dbP.then((db) => {
	//         const val = (db as any)[prop];
	//         if (typeof val === "function") return val.bind(db);
	//         return val;
	//       });
	//       return p.then(onFulfilled, onRejected);
	//     };

	//     return asyncFn;
	//   },
	// }) as unknown as LazyIDB<InferDBSchema<T>>;

	// return proxy;
}

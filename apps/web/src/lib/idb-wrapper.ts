/** biome-ignore-all lint/suspicious/noThenProperty: idb wrapper */
import {
	openDB,
	type IDBPDatabase,
	type DBSchema,
	type OpenDBCallbacks,
} from "idb";

// Re-export everything from idb so users have full access to types
export type { DBSchema, IDBPDatabase, OpenDBCallbacks } from "idb";
export { deleteDB, wrap, unwrap } from "idb";

/**
 * Schema definition for declarative store/index creation.
 */
export interface StoreSchema {
	keyPath?: string;
	autoIncrement?: boolean;
	indexes?: {
		name: string;
		keyPath: string | string[];
		options?: IDBIndexParameters;
	}[];
}

export interface DatabaseSchema<DBTypes extends DBSchema | unknown = unknown> {
	stores: Record<string, StoreSchema>;
	/** Called after stores/indexes are created during upgrade. */
	onUpgrade?: OpenDBCallbacks<DBTypes>["upgrade"];
	blocked?: OpenDBCallbacks<DBTypes>["blocked"];
	blocking?: OpenDBCallbacks<DBTypes>["blocking"];
	terminated?: OpenDBCallbacks<DBTypes>["terminated"];
}

/**
 * A lazy-initializing proxy over IDBPDatabase.
 *
 * Every property access and method call on the proxy is forwarded
 * to the real IDBPDatabase – which is opened once on first use.
 *
 * Because the proxy itself is synchronous you can create it at
 * module scope without `await`:
 *
 * ```ts
 * const db = createLazyIDB<MyDB>('my-db', 1, { stores: { … } });
 * // later …
 * const item = await db.get('store', key);
 * ```
 */
export type LazyIDB<DBTypes extends DBSchema | unknown = unknown> =
	IDBPDatabase<DBTypes> & {
		/**
		 * Returns the underlying IDBPDatabase promise.
		 * Useful when you need the raw instance (e.g. to call `.close()`).
		 */
		readonly __dbPromise: Promise<IDBPDatabase<DBTypes>>;
		/** True after the first access has triggered `openDB`. */
		readonly __initialized: boolean;
		/** Always undefined – prevents the proxy from being treated as a thenable. */
		readonly then: undefined;
	};

/**
 * Create a lazily-initialized IDB database wrapped in a Proxy.
 *
 * The returned object looks and feels exactly like an `IDBPDatabase` –
 * every property/method is available – but the actual `openDB` call is
 * deferred until the first interaction.
 *
 * @param name     Database name
 * @param version  Schema version number
 * @param schema   Declarative schema (stores, indexes, callbacks)
 */
export function createLazyIDB<DBTypes extends DBSchema | unknown = unknown>(
	name: string,
	version: number,
	schema: DatabaseSchema<DBTypes>,
): LazyIDB<DBTypes> {
	let dbPromise: Promise<IDBPDatabase<DBTypes>> | null = null;
	let initialized = false;

	function ensureDB(): Promise<IDBPDatabase<DBTypes>> {
		if (dbPromise) return dbPromise;

		initialized = true;
		dbPromise = openDB<DBTypes>(name, version, {
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
							keyPath: storeDef.keyPath,
							autoIncrement: storeDef.autoIncrement,
						});
					} else {
						store = transaction.objectStore(storeName as any);
					}

					for (const idx of storeDef.indexes ?? []) {
						if (!store.indexNames.contains(idx.name as any)) {
							(store as any).createIndex(idx.name, idx.keyPath, idx.options);
						}
					}
				}

				// Forward to user-supplied upgrade if provided
				schema.onUpgrade?.(db, oldVersion, newVersion, transaction, event);
			},
			blocked: schema.blocked,
			blocking: schema.blocking,
			terminated: schema.terminated,
		});

		return dbPromise;
	}

	// The proxy target is an empty function so we can also intercept `apply`
	// (not that IDBPDatabase is callable, but it keeps the proxy general).
	const target = Object.create(null) as IDBPDatabase<DBTypes>;

	const proxy = new Proxy(target, {
		get(_target, prop, _receiver) {
			// Expose internal helpers
			if (prop === "__dbPromise") return ensureDB();
			if (prop === "__initialized") return initialized;

			// `then` must return undefined so the proxy is NOT treated
			// as a thenable (which would break `await proxy.get(…)` etc.)
			if (prop === "then") return undefined;

			// Every other property access lazily opens the DB and
			// returns a promise-based trampoline.
			const dbP = ensureDB();

			// For known sync properties on IDBDatabase we can't really
			// return them synchronously since we don't have the db yet.
			// Instead we return an async function that resolves and
			// calls through. This keeps the API consistent: every call
			// returns a promise.
			//
			// If the underlying value is a function we return an async
			// wrapper; if it's a plain value we return a promise for it
			// (via a getter-like proxy that auto-awaits).

			// We return an async function wrapper.  The caller will
			// `await db.someMethod(args)` which works naturally.
			// For property reads (like `db.name`, `db.objectStoreNames`)
			// the caller can `await db.name`.
			//
			// BUT – `transaction()` returns a *synchronous* transaction
			// object with `.store`, `.done`, etc.  We need to handle
			// this properly by returning a "then-able" wrapper.

			// Strategy: return a function that, when called, awaits the
			// db and calls the real method.  If NOT called (i.e. property
			// read), we make the function also a thenable so `await db.name`
			// works.
			const asyncFn = async (...args: unknown[]) => {
				const db = await dbP;
				const val = (db as any)[prop];
				if (typeof val === "function") {
					return val.apply(db, args);
				}
				return val;
			};

			// Make the function thenable so property access via `await` works:
			//   const name = await db.name;
			asyncFn.then = (
				onFulfilled?: (v: unknown) => unknown,
				onRejected?: (e: unknown) => unknown,
			) => {
				const p = dbP.then((db) => {
					const val = (db as any)[prop];
					// If the property itself is a function, return it bound
					if (typeof val === "function") return val.bind(db);
					return val;
				});
				return p.then(onFulfilled, onRejected);
			};

			return asyncFn;
		},
	}) as unknown as LazyIDB<DBTypes>;

	return proxy;
}

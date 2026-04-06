import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLazyIDB, type LazyIDB } from "./idb-wrapper";
import type { DBSchema } from "idb";

// ── Schema ────────────────────────────────────────────────────────────
interface TestDB extends DBSchema {
	users: {
		key: string;
		value: { id: string; name: string; email: string; age?: number };
		indexes: { "by-email": string };
	};
	todos: {
		key: number;
		value: { id?: number; title: string; completed: number; userId: string };
		indexes: { "by-user": string; "by-completed": number };
	};
}

const testSchema = {
	stores: {
		users: {
			keyPath: "id",
			indexes: [
				{ name: "by-email", keyPath: "email", options: { unique: true } },
			],
		},
		todos: {
			keyPath: "id",
			autoIncrement: true,
			indexes: [
				{ name: "by-user", keyPath: "userId" },
				{ name: "by-completed", keyPath: "completed" },
			],
		},
	},
};

// ── Helpers ───────────────────────────────────────────────────────────
let dbCounter = 0;
function uniqueName(prefix = "test-db") {
	return `${prefix}-${Date.now()}-${++dbCounter}`;
}

async function cleanupDB(db: LazyIDB<any>, name: string) {
	const real = await db.__dbPromise;
	real.close();
	indexedDB.deleteDatabase(name);
}

// ── Unit Tests ────────────────────────────────────────────────────────
describe("LazyIDB – Unit Tests", () => {
	let db: LazyIDB<TestDB>;
	let dbName: string;

	beforeEach(() => {
		dbName = uniqueName();
		db = createLazyIDB<TestDB>(dbName, 1, testSchema);
	});

	afterEach(async () => {
		await cleanupDB(db, dbName);
	});

	// ─── Creation ──────────────────────────────────────
	describe("Lazy creation", () => {
		it("creates synchronously, without await", () => {
			const name = uniqueName("sync");
			const lazy = createLazyIDB<TestDB>(name, 1, testSchema);
			// It's a proxy, not a promise – confirm it doesn't have a .then own property
			expect(lazy.then).toBeUndefined();
			// Not yet initialized
			expect(lazy.__initialized).toBe(false);
		});

		it("initialises on first operation", async () => {
			expect(db.__initialized).toBe(false);
			await db.count("users");
			expect(db.__initialized).toBe(true);
		});

		it("reuses the same underlying db across calls", async () => {
			const a = await db.__dbPromise;
			const b = await db.__dbPromise;
			expect(a).toBe(b);
		});
	});

	// ─── CRUD: put / get / add / delete / clear / count ─
	describe("CRUD operations", () => {
		it("put + get", async () => {
			const user = { id: "1", name: "Alice", email: "alice@test.com" };
			await db.put("users", user);
			const result = await db.get("users", "1");
			expect(result).toEqual(user);
		});

		it("get returns undefined for missing key", async () => {
			const r = await db.get("users", "nope");
			expect(r).toBeUndefined();
		});

		it("put overwrites existing record", async () => {
			await db.put("users", { id: "1", name: "Alice", email: "a@t.com" });
			await db.put("users", { id: "1", name: "Bob", email: "b@t.com" });
			const r = await db.get("users", "1");
			expect(r!.name).toBe("Bob");
		});

		it("add with auto-increment key", async () => {
			const k1 = await db.add("todos", {
				title: "T1",
				completed: 0,
				userId: "1",
			});
			const k2 = await db.add("todos", {
				title: "T2",
				completed: 1,
				userId: "1",
			});
			expect(typeof k1).toBe("number");
			expect(Number(k2)).toBeGreaterThan(Number(k1));
		});

		it("delete removes a record", async () => {
			await db.put("users", { id: "1", name: "Alice", email: "a@t.com" });
			await db.delete("users", "1");
			expect(await db.get("users", "1")).toBeUndefined();
		});

		it("clear removes all records in a store", async () => {
			await db.put("users", { id: "1", name: "A", email: "a@t.com" });
			await db.put("users", { id: "2", name: "B", email: "b@t.com" });
			await db.clear("users");
			expect(await db.count("users")).toBe(0);
		});

		it("count returns correct number", async () => {
			expect(await db.count("users")).toBe(0);
			await db.put("users", { id: "1", name: "A", email: "a@t.com" });
			await db.put("users", { id: "2", name: "B", email: "b@t.com" });
			expect(await db.count("users")).toBe(2);
		});

		it("getAll returns all records", async () => {
			await db.put("users", { id: "1", name: "A", email: "a@t.com" });
			await db.put("users", { id: "2", name: "B", email: "b@t.com" });
			const all = await db.getAll("users");
			expect(all).toHaveLength(2);
		});

		it("getAll with count limits results", async () => {
			for (let i = 0; i < 5; i++) {
				await db.put("users", {
					id: `${i}`,
					name: `U${i}`,
					email: `u${i}@t.com`,
				});
			}
			const limited = await db.getAll("users", null, 3);
			expect(limited).toHaveLength(3);
		});

		it("getAllKeys returns keys", async () => {
			await db.put("users", { id: "a", name: "A", email: "a@t.com" });
			await db.put("users", { id: "b", name: "B", email: "b@t.com" });
			const keys = await db.getAllKeys("users");
			expect(keys).toContain("a");
			expect(keys).toContain("b");
		});

		it("getKey returns first matching key", async () => {
			await db.put("users", { id: "x", name: "X", email: "x@t.com" });
			const key = await db.getKey("users", "x");
			expect(key).toBe("x");
		});
	});

	// ─── Shortcut index methods on IDBPDatabase ─────────
	describe("Index shortcuts (getFromIndex, getAllFromIndex, etc.)", () => {
		it("getFromIndex", async () => {
			await db.put("users", {
				id: "1",
				name: "Alice",
				email: "alice@test.com",
			});
			const r = await db.getFromIndex("users", "by-email", "alice@test.com");
			expect(r!.id).toBe("1");
		});

		it("getAllFromIndex", async () => {
			await db.add("todos", { title: "T1", completed: 0, userId: "1" });
			await db.add("todos", { title: "T2", completed: 1, userId: "1" });
			await db.add("todos", { title: "T3", completed: 0, userId: "2" });

			const u1 = await db.getAllFromIndex("todos", "by-user", "1");
			expect(u1).toHaveLength(2);

			const u2 = await db.getAllFromIndex("todos", "by-user", "2");
			expect(u2).toHaveLength(1);
		});

		it("countFromIndex", async () => {
			await db.add("todos", { title: "T1", completed: 0, userId: "1" });
			await db.add("todos", { title: "T2", completed: 1, userId: "1" });
			const c = await db.countFromIndex("todos", "by-user", "1");
			expect(c).toBe(2);
		});

		it("getKeyFromIndex", async () => {
			await db.put("users", {
				id: "u1",
				name: "Alice",
				email: "alice@test.com",
			});
			const k = await db.getKeyFromIndex("users", "by-email", "alice@test.com");
			expect(k).toBe("u1");
		});

		it("getAllKeysFromIndex", async () => {
			await db.add("todos", { title: "T1", completed: 0, userId: "1" });
			await db.add("todos", { title: "T2", completed: 0, userId: "1" });
			const keys = await db.getAllKeysFromIndex("todos", "by-user", "1");
			expect(keys).toHaveLength(2);
		});
	});

	// ─── transaction() ──────────────────────────────────
	describe("transaction()", () => {
		it("can run a readwrite transaction", async () => {
			const tx = db.transaction("users", "readwrite");
			const store = tx.store;
			await store.put({ id: "1", name: "Alice", email: "a@t.com" });
			await store.put({ id: "2", name: "Bob", email: "b@t.com" });
			await tx.done;

			const all = await db.getAll("users");
			expect(all).toHaveLength(2);
		});

		it("can run a readonly transaction", async () => {
			await db.put("users", { id: "1", name: "Alice", email: "a@t.com" });

			const tx = db.transaction("users", "readonly");
			const val = await tx.store.get("1");
			expect(val!.name).toBe("Alice");
		});

		it("multi-store transaction", async () => {
			await db.put("users", { id: "u1", name: "Alice", email: "a@t.com" });
			await db.add("todos", { title: "T1", completed: 0, userId: "u1" });

			const tx = db.transaction(["users", "todos"], "readonly");
			const user = await tx.objectStore("users").get("u1");
			const todosStore = tx.objectStore("todos");
			const allTodos = await todosStore.getAll();
			await tx.done;

			expect(user!.name).toBe("Alice");
			expect(allTodos).toHaveLength(1);
		});
	});

	// ─── Property access via await ──────────────────────
	describe("Property access (awaitable)", () => {
		it("objectStoreNames is accessible via __dbPromise", async () => {
			const real = await db.__dbPromise;
			const names = Array.from(real.objectStoreNames);
			expect(names).toContain("users");
			expect(names).toContain("todos");
		});
	});

	// ─── Concurrent operations ──────────────────────────
	describe("Concurrency", () => {
		it("handles many concurrent writes", async () => {
			const promises = Array.from({ length: 20 }, (_, i) =>
				db.put("users", { id: `${i}`, name: `U${i}`, email: `u${i}@t.com` }),
			);
			await Promise.all(promises);
			expect(await db.count("users")).toBe(20);
		});

		it("multiple lazy DBs can coexist", async () => {
			const nameA = uniqueName("coexist-a");
			const nameB = uniqueName("coexist-b");
			const a = createLazyIDB<TestDB>(nameA, 1, testSchema);
			const b = createLazyIDB<TestDB>(nameB, 1, testSchema);

			await a.put("users", { id: "1", name: "fromA", email: "a@t.com" });
			await b.put("users", { id: "1", name: "fromB", email: "b@t.com" });

			expect((await a.get("users", "1"))!.name).toBe("fromA");
			expect((await b.get("users", "1"))!.name).toBe("fromB");

			await cleanupDB(a, nameA);
			await cleanupDB(b, nameB);
		});
	});
});

// ── Integration Tests ─────────────────────────────────────────────────
describe("LazyIDB – Integration Tests", () => {
	let db: LazyIDB<any>;
	let dbName: string;

	beforeEach(() => {
		dbName = uniqueName("integ");
		db = createLazyIDB(dbName, 1, {
			stores: {
				notes: {
					keyPath: "id",
					indexes: [
						{ name: "by-created", keyPath: "createdAt" },
						{ name: "by-category", keyPath: "category" },
					],
				},
				settings: { keyPath: "key" },
			},
		});
	});

	afterEach(async () => {
		await cleanupDB(db, dbName);
	});

	it("stores and retrieves complex nested data", async () => {
		const note = {
			id: "1",
			title: "Complex",
			tags: ["a", "b"],
			meta: { author: "X", views: 42 },
			createdAt: new Date().toISOString(),
			category: "work",
		};
		await db.put("notes", note);
		const r = await db.get("notes", "1");
		expect(r).toEqual(note);
		expect(Array.isArray(r.tags)).toBe(true);
	});

	it("handles 100 records", async () => {
		const promises = Array.from({ length: 100 }, (_, i) =>
			db.put("notes", {
				id: `n${i}`,
				title: `Note ${i}`,
				createdAt: new Date(Date.now() - i * 1000).toISOString(),
				category: i % 2 === 0 ? "work" : "personal",
			}),
		);
		await Promise.all(promises);
		expect(await db.count("notes")).toBe(100);

		const work = await db.getAllFromIndex("notes", "by-category", "work");
		expect(work).toHaveLength(50);
	});

	it("maintains data integrity across put/update/delete", async () => {
		const note = {
			id: "x",
			title: "A",
			createdAt: "2024-01-01",
			category: "c",
		};
		await db.put("notes", note);
		expect(await db.get("notes", "x")).toEqual(note);

		await db.put("notes", { ...note, title: "B" });
		expect((await db.get("notes", "x")).title).toBe("B");

		await db.delete("notes", "x");
		expect(await db.get("notes", "x")).toBeUndefined();
	});

	it("cursor-based iteration via transaction", async () => {
		await db.put("notes", {
			id: "1",
			title: "A",
			createdAt: "2024-01-01",
			category: "a",
		});
		await db.put("notes", {
			id: "2",
			title: "B",
			createdAt: "2024-01-02",
			category: "b",
		});
		await db.put("notes", {
			id: "3",
			title: "C",
			createdAt: "2024-01-03",
			category: "a",
		});

		const tx = await db.transaction("notes", "readonly");
		const store = tx.store;
		let cursor = await store.openCursor();
		const titles: string[] = [];
		while (cursor) {
			titles.push(cursor.value.title);
			cursor = await cursor.continue();
		}
		expect(titles).toEqual(["A", "B", "C"]);
	});
});

// ── Schema & Upgrade Tests ────────────────────────────────────────────
describe("LazyIDB – Schema & Upgrades", () => {
	it("creates declared stores and indexes", async () => {
		const name = uniqueName("schema");
		const db = createLazyIDB(name, 1, {
			stores: {
				books: {
					keyPath: "isbn",
					indexes: [
						{ name: "by-title", keyPath: "title" },
						{ name: "by-author", keyPath: "author" },
					],
				},
				authors: { keyPath: "id", autoIncrement: true },
			},
		});

		await db.put("books", { isbn: "123", title: "T", author: "A" });
		const byTitle = await db.getFromIndex("books", "by-title", "T");
		expect(byTitle.isbn).toBe("123");

		await cleanupDB(db, name);
	});

	it("calls onUpgrade callback", async () => {
		let called = false;
		let oldVer = -1;

		const name = uniqueName("upgrade");
		const db = createLazyIDB(name, 1, {
			stores: { t: { keyPath: "id" } },
			onUpgrade(_db, ov) {
				called = true;
				oldVer = ov;
			},
		});

		await db.count("t");
		expect(called).toBe(true);
		expect(oldVer).toBe(0);

		await cleanupDB(db, name);
	});

	it("forwards blocked / blocking / terminated callbacks", () => {
		// Just verify they're accepted without error
		const name = uniqueName("cbs");
		const db = createLazyIDB(name, 1, {
			stores: { t: { keyPath: "id" } },
			blocked() {
				/* noop */
			},
			blocking() {
				/* noop */
			},
			terminated() {
				/* noop */
			},
		});
		expect(db).toBeTruthy();
	});
});

// ── Proxy-specific behaviour ──────────────────────────────────────────
describe("LazyIDB – Proxy behaviour", () => {
	it("is not a thenable (no .then)", () => {
		const name = uniqueName("thenable");
		const db = createLazyIDB(name, 1, { stores: { s: { keyPath: "id" } } });
		// This is critical: if .then is defined, `await db` would resolve
		// to the underlying IDBPDatabase, breaking the proxy.
		expect(db.then).toBeUndefined();
	});

	it("works with await on method calls", async () => {
		const name = uniqueName("await-method");
		const db = createLazyIDB<TestDB>(name, 1, testSchema);
		await db.put("users", { id: "u1", name: "A", email: "a@t.com" });
		const r = await db.get("users", "u1");
		expect(r!.name).toBe("A");
		await cleanupDB(db, name);
	});

	it("__dbPromise gives access to the raw IDBPDatabase", async () => {
		const name = uniqueName("raw");
		const db = createLazyIDB<TestDB>(name, 1, testSchema);
		await db.count("users"); // trigger init
		const raw = await db.__dbPromise;
		expect(raw.name).toBe(name);
		await cleanupDB(db, name);
	});
});

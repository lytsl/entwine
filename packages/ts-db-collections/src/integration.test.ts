import { beforeEach, describe, expect, it } from "vitest";

type IDBTransactionMode = "readonly" | "readwrite" | "versionchange";

class MockIDBStore {
	data: Map<string | number, any> = new Map();
	keyPath?: string;
}

class MockIDBTransaction {
	stores: Map<string, MockIDBStore>;
	mode: IDBTransactionMode;

	constructor(stores: Map<string, MockIDBStore>, mode: IDBTransactionMode) {
		this.stores = stores;
		this.mode = mode;
	}

	objectStore(name: string): MockIDBObjectStore {
		const store = this.stores.get(name);
		if (!store) throw new Error(`ObjectStore "${name}" not found`);
		return new MockIDBObjectStore(store);
	}

	async done(): Promise<void> {}
}

class MockIDBObjectStore {
	store: MockIDBStore;

	constructor(store: MockIDBStore) {
		this.store = store;
	}

	async getAll(): Promise<any[]> {
		return Array.from(this.store.data.values());
	}

	async put(value: any): Promise<string | number> {
		const key = this.store.keyPath ? value[this.store.keyPath] : value.id;
		this.store.data.set(key, value);
		return key;
	}

	async delete(key: string | number): Promise<void> {
		this.store.data.delete(key);
	}
}

class MockIDBDatabase {
	stores: Map<string, MockIDBStore> = new Map();
	objectStoreNames: string[] = [];

	createObjectStore(
		name: string,
		options?: { keyPath?: string },
	): MockIDBObjectStore {
		this.objectStoreNames.push(name);
		const store: MockIDBStore = {
			data: new Map(),
			keyPath: options?.keyPath || "id",
		};
		this.stores.set(name, store);
		return new MockIDBObjectStore(store);
	}

	transaction(
		storeNames: string | string[],
		mode: IDBTransactionMode,
	): MockIDBTransaction {
		const stores = new Map<string, MockIDBStore>();
		const names = Array.isArray(storeNames) ? storeNames : [storeNames];
		for (const name of names) {
			const store = this.stores.get(name);
			if (!store) throw new Error(`ObjectStore "${name}" not found`);
			stores.set(name, store);
		}
		return new MockIDBTransaction(stores, mode);
	}
}

describe("IDB Collection Integration", () => {
	let mockDb: MockIDBDatabase;

	beforeEach(() => {
		mockDb = new MockIDBDatabase();
		mockDb.createObjectStore("users", { keyPath: "id" });
	});

	describe("Mock IDB", () => {
		it("should create a database with object store", () => {
			const db = new MockIDBDatabase();
			db.createObjectStore("items", { keyPath: "id" });
			expect(db.objectStoreNames).toContain("items");
		});

		it("should put and get data", async () => {
			const db = new MockIDBDatabase();
			db.createObjectStore("items", { keyPath: "id" });

			const tx = db.transaction("items", "readwrite");
			const store = tx.objectStore("items");
			await store.put({ id: "1", name: "Test" });
			await tx.done();

			const readTx = db.transaction("items", "readonly");
			const readStore = readTx.objectStore("items");
			const items = await readStore.getAll();

			expect(items).toHaveLength(1);
			expect(items[0]?.name).toBe("Test");
		});

		it("should delete data", async () => {
			const db = new MockIDBDatabase();
			db.createObjectStore("items", { keyPath: "id" });

			const tx = db.transaction("items", "readwrite");
			const store = tx.objectStore("items");
			await store.put({ id: "1", name: "Test" });
			await tx.done();

			const deleteTx = db.transaction("items", "readwrite");
			const deleteStore = deleteTx.objectStore("items");
			await deleteStore.delete("1");
			await deleteTx.done();

			const readTx = db.transaction("items", "readonly");
			const readStore = readTx.objectStore("items");
			const items = await readStore.getAll();

			expect(items).toHaveLength(0);
		});

		it("should store multiple items", async () => {
			const tx = mockDb.transaction("users", "readwrite");
			const store = tx.objectStore("users");
			await store.put({ id: "1", name: "Alice", age: 25 });
			await store.put({ id: "2", name: "Bob", age: 30 });
			await store.put({ id: "3", name: "Charlie", age: 35 });
			await tx.done();

			const readTx = mockDb.transaction("users", "readonly");
			const readStore = readTx.objectStore("users");
			const users = await readStore.getAll();

			expect(users).toHaveLength(3);
		});
	});
});

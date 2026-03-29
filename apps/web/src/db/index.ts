import { openDB } from "idb";

export const idbModelNames = ["issue"] as const;
export type IdbModelName = (typeof idbModelNames)[number];
const kvNames = ["_metadata"];

export const db = await openDB("linear", 1, {
	upgrade(db, _oldVersion, _newVersion, _transaction, _event) {
		for (const modelName of idbModelNames) {
			if (!db.objectStoreNames.contains(modelName))
				db.createObjectStore(modelName, {
					keyPath: "id",
					autoIncrement: false,
				});
		}
		for (const modelName of kvNames) {
			if (!db.objectStoreNames.contains(modelName))
				db.createObjectStore(modelName);
		}
	},
	blocked(_currentVersion, _blockedVersion, _event) {
		// …
	},
	blocking(_currentVersion, _blockedVersion, _event) {
		// …
	},
	terminated() {
		// …
	},
});

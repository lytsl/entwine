import type { idbSchema } from "@/lib/db/schema";

export type IdbModelName = keyof typeof idbSchema;
const kvNames = ["_metadata"];

// export const db = await openDB("linear", 1, {
// 	upgrade(db, _oldVersion, _newVersion, _transaction, _event) {
// 		for (const modelName of idbModelNames) {
// 			if (!db.objectStoreNames.contains(modelName))
// 				db.createObjectStore(modelName, {
// 					keyPath: "id",
// 					autoIncrement: false,
// 				});
// 		}
// 		for (const modelName of kvNames) {
// 			if (!db.objectStoreNames.contains(modelName))
// 				db.createObjectStore(modelName);
// 		}
// 	},
// 	blocked(_currentVersion, _blockedVersion, _event) {
// 		// …
// 	},
// 	blocking(_currentVersion, _blockedVersion, _event) {
// 		// …
// 	},
// 	terminated() {
// 		// …
// 	},
// });

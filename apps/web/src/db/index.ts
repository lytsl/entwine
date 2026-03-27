import { openDB } from "idb";

const modelNames = ["issue"];

export const db = await openDB("linear", 1, {
  upgrade(db, oldVersion, newVersion, transaction, event) {
    for (const modelName of modelNames) {
      if (!db.objectStoreNames.contains(modelName))
        db.createObjectStore(modelName, {
          keyPath: "id",
          autoIncrement: false,
        });
      const metadataName = `_${modelName}_metadata`;
      if (!db.objectStoreNames.contains(metadataName))
        db.createObjectStore(metadataName);
    }
  },
  blocked(currentVersion, blockedVersion, event) {
    // …
  },
  blocking(currentVersion, blockedVersion, event) {
    // …
  },
  terminated() {
    // …
  },
});

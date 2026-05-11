import { type Collection, createCollection } from "@tanstack/react-db"; //
import type { z } from "zod";

// Assuming ZodDBSchemaDef is imported from your previous definitions
import type { LazyIDB, ZodDBSchemaDef } from "./idb-wrapper";
import { webSocketCollectionOptions } from "./sync/tdb-collection";
import { syncEventBus } from "./sync/events";

/**
 * Maps the inferred Zod schema types directly to TanStack DB Collection types.
 */
export type TanStackCollections<T extends ZodDBSchemaDef> = {
  [K in keyof T]: Collection<z.infer<T[K]["schema"]>>;
};

/**
 * Transforms a ZodDBSchemaDef into a typed record of TanStack DB Collections.
 */
export function createTanStackCollections<T extends ZodDBSchemaDef>(
  db: LazyIDB,
  schema: T,
) {
  // return new Promise<TanStackCollections<T>>((resolve, reject) => {
  const collections: Record<string, any> = {};
  const schemaEntries = Object.entries(schema);

  // console.log("on ", `${schemaEntries.at(-1)?.[0]}:syncInitiated`);
  // syncEventBus.on(`${schemaEntries.at(-1)?.[0]}:syncInitiated`, {
  //   handle: () => {
  //     resolve(collections as TanStackCollections<T>);
  //   },
  //   once: true,
  // });

  for (const [storeName, storeDef] of schemaEntries) {
    const collection = createCollection(
      webSocketCollectionOptions({
        schema: storeDef.schema,
        modelName: storeName,
        db,
      }),
    );
    collections[storeName] = collection;

    collection.startSyncImmediate();
  }

  return collections;

  // setTimeout(() => {
  //   reject(`syncInitiated was not triggered after 1 second`);
  // }, 1000);
  // });
}

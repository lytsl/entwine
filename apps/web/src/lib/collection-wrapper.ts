import {
	type Collection,
	createCollection,
	localOnlyCollectionOptions,
} from "@tanstack/react-db"; //
import { z } from "zod";

// Assuming ZodDBSchemaDef is imported from your previous definitions
import type { LazyIDB, ZodDBSchemaDef } from "./idb-wrapper";
import { webSocketCollectionOptions } from "./sync/tdb-collection";

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
): TanStackCollections<T> {
	const collections: Record<string, any> = {};

	for (const [storeName, storeDef] of Object.entries(schema)) {
		// Fallback to "id" if keyPath isn't explicitly defined in the schema
		const keyProp = (storeDef.keyPath as string) || "id";

		// TanStack DB collections require a unique key identifier for normalization.
		collections[storeName] = createCollection(
			webSocketCollectionOptions({
				schema: storeDef.schema,
				modelName: storeName,
				db,
			}),
		);
	}

	return collections as TanStackCollections<T>;
}

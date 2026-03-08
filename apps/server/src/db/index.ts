import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../../env";
import * as schema from "./schema";
import { createDrizzleExtension } from "./utils/sync-extension";

const client = createClient({
	url: env.DATABASE_URL,
});

export const db = createDrizzleExtension(drizzle({ client, schema }));

export const dbSchema = schema;

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../../env";
import dbSchema from "./schema";
import relations from "./schema/relations";

// import { createDrizzleExtension } from "./utils/sync-extension";

const client = createClient({
  url: env.DATABASE_URL,
});

export const db = drizzle({ client, schema: dbSchema, relations });

export { dbSchema };

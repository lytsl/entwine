import { type } from "arktype";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { defineModelConfig } from "../utils/define-model-config";

const table = sqliteTable("issue", {
	id: text("id").primaryKey().notNull(),
	title: text()
		.notNull()
		.meta({ validationSchema: type("string.trim") }),
	description: text()
		.notNull()
		.meta({ validationSchema: type("string.trim") }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
		.meta({ readOnly: true }),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull()
		.meta({ readOnly: true }),
});

const config = defineModelConfig(table);

export default { Issue: { table, config } };

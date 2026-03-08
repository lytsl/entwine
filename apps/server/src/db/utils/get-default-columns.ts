import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";

export function getDefaultColumns() {
	return {
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		hlc: text("hlc").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
	};
}

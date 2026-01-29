import { DbType } from "@entwine/typebox";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export const todo = sqliteTable("todo", {
	id: DbType.Integer().primaryKey(),
	text: DbType.String({ minLength: 1 }).notNull(),
	completed: DbType.Boolean({ default: false }).default(false).notNull(),
});

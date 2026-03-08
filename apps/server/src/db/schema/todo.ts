import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "@entwine/drizzle-arktype";
import { type } from "arktype";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const todo = sqliteTable("todo", {
	id: integer().primaryKey({ autoIncrement: true }),
	text: text().notNull().arktype(type("string > 0")),
	completed: integer({ mode: "boolean" }).default(false).notNull(),
});

export const todoSchema = {
	create: createInsertSchema(todo),
	update: createUpdateSchema(todo),
	select: createSelectSchema(todo),
};

import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "@entwine/drizzle-typebox";
import { type TSchemaOptions, type TStringOptions, Type } from "@entwine/typebox";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const todo = sqliteTable("todo", {
	id: integer().primaryKey({ autoIncrement: true }),
	text: text()
		.notNull()
		.typebox(Type.String({  minLength: 1 })),
	completed: integer({ mode: "boolean" })
		.default(false)
		.notNull()
		.typebox((schema: TSchemaOptions)=>Type.Boolean({...schema})),
});

export const todoSchema = {
	create: createInsertSchema(todo),
	update: createUpdateSchema(todo),
	select: createSelectSchema(todo),
};

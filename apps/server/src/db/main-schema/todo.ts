import { type } from "arktype";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "../drizzle-arktype";

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

export default { todo };

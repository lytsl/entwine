import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { getDefaultColumns } from "../utils/get-default-columns";

export const tasks = sqliteTable("tasks", {
	...getDefaultColumns(),
	title: text("title").notNull(),
	status: text("status").notNull().default("pending"),
});

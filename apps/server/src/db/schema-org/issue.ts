import { type } from "arktype";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "../drizzle-arktype";

export const issue = sqliteTable("issue", {
	// ...getDefaultColumns(),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID())
		.notNull(),
	// identifier: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	// status: Status,
	// assignee: text("assignee").references(() => user.id, {
	// 	onDelete: "set null",
	// }),
	// priority: Priority,
	// labels: LabelInterface[],
	// cycleId: string,
	// project?: Project,
	// subissues?: string[],
	rank: text().notNull(),
	// dueDate: integer("deleted_at", { mode: "timestamp_ms" }),
});

export default { issue };

export const issueSchema = {
	create: type({ data: createInsertSchema(issue) })
		.array()
		.atLeastLength(1),
	update: type({ id: "string", data: createUpdateSchema(issue) })
		.array()
		.atLeastLength(1),
	select: createSelectSchema(issue),
	delete: type({ id: "string" }).array().atLeastLength(1),
};

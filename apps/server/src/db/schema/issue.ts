import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "@entwine/drizzle-arktype";
import { type } from "arktype";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const issue = sqliteTable("issue", {
	// ...getDefaultColumns(),
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
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

export const issueSchema = {
	create: createInsertSchema(issue),
	update: type({ id: "string", changes: createUpdateSchema(issue) })
		.array()
		.atLeastLength(1),
	select: createSelectSchema(issue),
};

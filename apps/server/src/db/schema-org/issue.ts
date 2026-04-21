import { type } from "arktype";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { customJson } from "../utils/custom-drizzle-types";
import { defineModelConfig } from "../utils/define-model-config";

export enum IssuePriority {
	NO_PRIORITY = 0,
	LOW = 1,
	MEDIUM = 2,
	HIGH = 3,
	URGENT = 4,
}

const issueTable = sqliteTable(
	"issue",
	{
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
		teamId: text("team_id").notNull(),
		teamNumber: integer("team_number").notNull().meta({ readOnly: true }),
		statusId: text("status_id")
			.notNull()
			.references(() => issueStatusTable.id, { onDelete: "restrict" }),
		assigneeId: text("assignee_id").notNull(),
		priority: integer()
			.notNull()
			.meta({ validationSchema: type.enumerated(IssuePriority) }),
		labels: customJson<string[]>("labels").meta({
			validationSchema: type("string[]"),
		}),
		projectId: text("project_id").references(() => projectTable.id, {
			onDelete: "set null",
		}),
		subissues: integer(),
		rank: text().notNull(),
		dueDate: integer("due_date", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("issue_assigneeId_idx").on(table.assigneeId),
		index("issue_rank_idx").on(table.rank),
		index("issue_teamId_idx").on(table.teamId),
	],
);

const issueStatusTable = sqliteTable("issue_status", {
	id: text("id").primaryKey().notNull(),
	title: text()
		.notNull()
		.meta({ validationSchema: type("string.trim") }),
	description: text().meta({ validationSchema: type("string.trim") }),
});

const projectTable = sqliteTable("project", {
	id: text("id").primaryKey().notNull(),
	title: text()
		.notNull()
		.meta({ validationSchema: type("string.trim") }),
	description: text().meta({ validationSchema: type("string.trim") }),
});

export default {
	Issue: { table: issueTable, config: defineModelConfig(issueTable) },
};

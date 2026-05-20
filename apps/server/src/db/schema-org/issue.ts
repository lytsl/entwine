import { and, defineRelations, eq, sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { customJson } from "../utils/custom-drizzle-types";
import { defineModelConfig } from "../utils/define-model-config";
import metadataSchema from "./metadata";

export enum IssuePriority {
	NO_PRIORITY = 0,
	LOW = 1,
	MEDIUM = 2,
	HIGH = 3,
	URGENT = 4,
}

export enum IssueStatusType {
	Backlog = "Backlog",
	Planned = "Planned",
	InProgress = "In Progress",
	Completed = "Completed",
	Canceled = "Canceled",
}

export const Issue = sqliteTable(
	"issue",
	{
		id: text("id").primaryKey().notNull(),
		title: text().notNull().meta({ validationSchema: z.string().trim() }),
		description: text().notNull().meta({ validationSchema: z.string().trim() }),
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
			.references(() => IssueStatus.id, { onDelete: "restrict" }),
		assigneeId: text("assignee_id"),
		priority: integer()
			.notNull()
			.meta({ validationSchema: z.enum(IssuePriority) }),
		labels: customJson<string[]>("labels").meta({
			validationSchema: z.string().array(),
		}),
		projectId: text("project_id").references(() => Project.id, {
			onDelete: "set null",
		}),
		parentId: text("parent_id"),
		// subIssueCount: integer(),
		rank: text().notNull(),
		dueDate: integer("due_date", { mode: "timestamp_ms" }),
	},
	(table) => [
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "issue_parentId_fk",
		}).onDelete("set null"),
		index("issue_rank_idx").on(table.rank),
		index("issue_assigneeId_idx").on(table.assigneeId),
		index("issue_teamId_idx").on(table.teamId),
		unique().on(table.teamId, table.teamNumber),
	],
);

export const IssueStatus = sqliteTable("issue_status", {
	id: text("id")
		.primaryKey()
		.notNull()
		.$defaultFn(() => crypto.randomUUID()),
	name: text().notNull().unique().meta({ validationSchema: z.string().trim() }),
	description: text().meta({ validationSchema: z.string().trim() }),
	type: text()
		.notNull()
		.meta({ validationSchema: z.enum(IssueStatusType) }),
	indefinite: integer({ mode: "boolean" })
		.default(false)
		.meta({ readOnly: true }),
});

export const Project = sqliteTable("project", {
	id: text("id").primaryKey().notNull(),
	name: text().notNull().unique().meta({ validationSchema: z.string().trim() }),
	description: text().meta({ validationSchema: z.string().trim() }),
});

const schema = {
	Issue,
	IssueStatus,
	Project,
};

export default schema;

export const config = {
	Issue: defineModelConfig(schema.Issue, {
		hooks: {
			txBeforeInsert({ payload, tx }) {
				const teamCountMap = payload.data.reduce(
					(acc, data) => {
						acc[data.teamId] = (acc[data.teamId] ?? 0) + 1;
						return acc;
					},
					{} as Record<string, number>,
				);

				const teamSeqMap = {} as Record<string, number>;
				Object.entries(teamCountMap).forEach(([teamId, count]) => {
					try {
						const [seqData] = tx
							.update(metadataSchema.EntitySequence)
							.set({
								sequence: sql`${metadataSchema.EntitySequence.sequence} + ${count}`,
							})
							.where(
								and(
									eq(metadataSchema.EntitySequence.entityId, teamId),
									eq(metadataSchema.EntitySequence.entityName, "Issue"),
								),
							)
							.returning({ sequence: metadataSchema.EntitySequence.sequence })
							.all();

						teamSeqMap[teamId] = seqData!.sequence;
					} catch (e) {
						tx.insert(metadataSchema.EntitySequence)
							.values({
								sequence: count,
								entityId: teamId,
								entityName: "Issue",
							})
							.run();
						teamSeqMap[teamId] = count;
					}
				});

				payload.data.reverse().forEach((data) => {
					data.teamNumber = teamSeqMap[data.teamId]!--;
				});
			},
		},
	}),
	IssueStatus: defineModelConfig(schema.IssueStatus),
	Project: defineModelConfig(schema.Project),
};

export const relations = defineRelations(schema, (r) => ({
	Issue: {
		Status: r.one.IssueStatus({
			from: r.Issue.statusId,
			to: r.IssueStatus.id,
		}),
		Project: r.one.Project({
			from: r.Issue.projectId,
			to: r.Project.id,
		}),
		Parent: r.one.Issue({
			from: r.Issue.parentId,
			to: r.Issue.id,
		}),
		Children: r.many.Issue({
			from: r.Issue.parentId,
			to: r.Issue.id,
		}),
	},
	IssueStatus: {
		Issues: r.many.Issue({
			from: r.IssueStatus.id,
			to: r.Issue.statusId,
		}),
	},
	Project: {
		Issues: r.many.Issue({
			from: r.Project.id,
			to: r.Issue.projectId,
		}),
	},
}));

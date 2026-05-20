import z from "zod";
import type { ZodDBSchemaDef } from "../idb-wrapper";

export const idbSchema = {
	Issue: {
		schema: z.object({
			assigneeId: z.string().nullable(),
			createdAt: z.coerce.date(),
			description: z.string(),
			dueDate: z.coerce.date().nullable(),
			id: z.string(),
			labels: z.array(z.string()).nullable(),
			parentId: z.string().nullable(),
			priority: z.number(),
			projectId: z.string().nullable(),
			rank: z.string(),
			statusId: z.string(),
			teamId: z.string(),
			teamNumber: z.number(),
			title: z.string(),
			updatedAt: z.coerce.date(),
		}),
	},
	IssueStatus: {
		schema: z.object({
			description: z.string().nullable(),
			id: z.string(),
			indefinite: z.boolean().nullable(),
			name: z.string(),
			type: z.string(),
		}),
	},
	Project: {
		schema: z.object({
			description: z.string().nullable(),
			id: z.string(),
			name: z.string(),
		}),
	},
	_metadata: {
		schema: z.any(),
	},
} satisfies ZodDBSchemaDef;

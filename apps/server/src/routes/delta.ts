import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq, gt, inArray } from "drizzle-orm";
import { createOrgApp } from "@/auth/org-auth.factory";
import { dbManager } from "@/db/db-manager";
import { orgSchema } from "@/db/schema-org";

const app = createOrgApp().get(
	"/",
	arktypeValidator("query", type({ lastSyncId: "string.integer.parse" })),
	async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const { lastSyncId } = c.req.valid("query");

		const dbSyncData = await db
			.select()
			.from(orgSchema.sync)
			.where(
				and(
					eq(orgSchema.sync.modelName, "issue"),
					gt(orgSchema.sync.id, lastSyncId),
				),
			);

		const filteredSyncData: typeof dbSyncData = [];
		dbSyncData.forEach((item) => {
			const existingItemIndex = filteredSyncData.findIndex(
				(existing) =>
					existing.modelName === item.modelName &&
					existing.modelId === item.modelId,
			);
			if (existingItemIndex >= 0) {
				if (item.id > dbSyncData[existingItemIndex]!.id) {
					filteredSyncData[existingItemIndex] = item;
				}
			} else {
				filteredSyncData.push(item);
			}
		});

		const issueData = await db
			.select()
			.from(orgSchema.issue)
			.where(
				inArray(
					orgSchema.issue.id,
					filteredSyncData.map((item) => item.modelId),
				),
			);

		const data = filteredSyncData.map((syncItem) => ({
			...syncItem,
			data: issueData.find((item) => item.id === syncItem.modelId),
		}));

		return c.json(data, 200);
	},
);
export default app;

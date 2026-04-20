import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq, gt, inArray } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import { createOrgApp } from "@/auth/org-auth.factory";
import { dbManager } from "@/db/db-manager";
import { orgSchema, orgSyncModels, type TOrgSyncModel } from "@/db/schema-org";

const app = createOrgApp().get(
	"/",
	arktypeValidator("query", type({ lastSyncId: "string.integer.parse" })),
	async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const { lastSyncId } = c.req.valid("query");

		const dbSyncData = db
			.select()
			.from(orgSchema.Sync)
			.where(
				and(
					eq(orgSchema.Sync.modelName, "issue"),
					gt(orgSchema.Sync.id, lastSyncId),
				),
			)
			.all();

		const filteredSyncData: typeof dbSyncData = [];
		// we want the sync events to be ordered in the way it happened but with the lastest sync action per modelName,modelId
		dbSyncData.forEach((item) => {
			const existingItemIndex = filteredSyncData.findIndex(
				(existing) =>
					existing.modelName === item.modelName &&
					existing.modelId === item.modelId,
			);
			if (existingItemIndex !== -1) {
				if (item.id > dbSyncData[existingItemIndex]!.id) {
					filteredSyncData[existingItemIndex] = item;
				}
			} else {
				filteredSyncData.push(item);
			}
		});

		const groupedSyncData = Object.entries(
			Object.groupBy(
				filteredSyncData.filter((item) => item.action !== "delete"),
				(item) => item.modelName,
			),
		).filter(([_, syncItems]) => syncItems && syncItems.length > 0);

		const dbModelData = groupedSyncData.flatMap(([modelName, syncItems]) => {
			const table = orgSchema[modelName as TOrgSyncModel];
			return db
				.select()
				.from(table)
				.where(
					inArray(
						table.id,
						syncItems!.map((item) => item.modelId),
					),
				)
				.all();
		});

		const data = filteredSyncData.map((syncItem) => ({
			...syncItem,
			data: dbModelData.find((item) => item.id === syncItem.modelId),
		}));

		return c.json(data, 200);
	},
);
export default app;

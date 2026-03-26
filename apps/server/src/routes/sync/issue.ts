import { arktypeValidator } from "@hono/arktype-validator";
import { and, eq, or, sql } from "drizzle-orm";
import { createPrivateApp } from "@/auth/auth.factory";
import { dbManager } from "@/db/db-manager";
import orgSchema from "@/db/schema-org";
import { issueSchema } from "@/db/schema-org/issue";
import { parseTanstackOptions } from "@/sync/tanstack-db/drizzle-adapter";
import { ParsedLoadSubsetOptions } from "@/sync/tanstack-db/types";

const app = createPrivateApp()
	.post("/", arktypeValidator("json", issueSchema.create), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json").map((item) => item.data);

		const syncData = await db.transaction(async (tx) => {
			const insertData = await tx
				.insert(orgSchema.issue)
				.values(payload)
				.returning();
			const syncData = await tx
				.insert(orgSchema.sync)
				.values(
					insertData.map((data) => ({
						modelName: "issue",
						modelId: data.id,
						action: "insert" as const,
						data: data,
					})),
				)

				.returning();
			return syncData;
		});

		const lastSyncId = syncData.reduce((mx, item) => Math.max(mx, item.id), 0);
		c.env.server.publish(
			"org",
			JSON.stringify({
				cmd: "sync",
				sync: syncData,
				lastSyncId,
			}),
		);
		return c.json({ lastSyncId }, 201);
	})
	.patch("/", arktypeValidator("json", issueSchema.update), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json");

		const syncData = await db.transaction(async (tx) => {
			const updateData = (
				await Promise.all(
					payload.map(({ id, data }) =>
						tx
							.update(orgSchema.issue)
							.set(data)
							.where(eq(orgSchema.issue.id, id))
							.returning(),
					) as unknown as [any, ...any[]],
				)
			).flat();

			// await tx
			// 	.delete(orgSchema.sync)
			// 	.where(
			// 		or(
			// 			...updateData.map((updateItem) =>
			// 				and(
			// 					eq(orgSchema.sync.modelId, updateItem.id),
			// 					eq(orgSchema.sync.modelName, "issue"),
			// 				),
			// 			),
			// 		),
			// 	);

			const syncData = await tx
				.insert(orgSchema.sync)
				.values(
					updateData.map((updateItem) => ({
						modelName: "issue",
						modelId: updateItem.id,
						action: "update" as const,
					})),
				)
				.onConflictDoUpdate({
					target: [orgSchema.sync.modelName, orgSchema.sync.modelId],
					set: { action: "update" as const },
				})
				.returning();
			return syncData.map((syncItem) => ({
				...syncItem,
				data: updateData.find(
					(updateItem) => updateItem.id === syncItem.modelId,
				),
			}));
		});

		const lastSyncId = syncData.reduce((mx, item) => Math.max(mx, item.id), 0);
		c.env.server.publish(
			"org",
			JSON.stringify({
				cmd: "sync",
				sync: syncData,
				lastSyncId,
			}),
		);
		return c.json({ lastSyncId }, 201);
	})
	.get("/", arktypeValidator("query", ParsedLoadSubsetOptions), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const query = c.req.valid("query");
		const parsedFilters = parseTanstackOptions(orgSchema.issue, query);

		let dbQuery = db.select().from(orgSchema.issue).$dynamic();
		if (parsedFilters.where.length) {
			dbQuery = dbQuery.where(and(...parsedFilters.where));
		}
		if (parsedFilters.orderBy.length) {
			dbQuery = dbQuery.orderBy(...parsedFilters.orderBy);
		}
		if (typeof parsedFilters.offset === "number") {
			dbQuery = dbQuery.offset(parsedFilters.offset);
		}
		if (typeof parsedFilters.limit === "number") {
			dbQuery = dbQuery.limit(parsedFilters.limit);
		}

		const data = await dbQuery;
		return c.json(data, 200);
	});

export default app;

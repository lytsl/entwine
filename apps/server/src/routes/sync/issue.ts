import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq, gt, inArray, max } from "drizzle-orm";
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
				.select({
					modelName: orgSchema.sync.modelName,
					modelId: orgSchema.sync.modelId,
					id: max(orgSchema.sync.id),
					action: orgSchema.sync.action,
				})
				.from(orgSchema.sync)
				.where(
					and(
						eq(orgSchema.sync.modelName, "issue"),
						inArray(
							orgSchema.sync.modelId,
							insertData.map((item) => item.id),
						),
					),
				)
				.groupBy(orgSchema.sync.modelName, orgSchema.sync.modelId);

			return syncData.map((item) => ({
				...item,
				data: insertData.find((insertItem) => insertItem.id === item.modelId),
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

			const syncData = await tx
				.select({
					modelName: orgSchema.sync.modelName,
					modelId: orgSchema.sync.modelId,
					id: max(orgSchema.sync.id),
					action: orgSchema.sync.action,
				})
				.from(orgSchema.sync)
				.where(
					and(
						eq(orgSchema.sync.modelName, "issue"),
						inArray(
							orgSchema.sync.modelId,
							updateData.map((item) => item.id),
						),
					),
				)
				.groupBy(orgSchema.sync.modelName, orgSchema.sync.modelId);

			return syncData.map((syncItem) => ({
				...syncItem,
				data: updateData.find((item) => item.id === syncItem.modelId),
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
	.delete("/", arktypeValidator("json", issueSchema.delete), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json");

		const syncData = await db.transaction(async (tx) => {
			await tx
				.delete(orgSchema.issue)
				.where(inArray(orgSchema.issue.id, payload.ids));

			const syncData = await tx
				.select({
					modelName: orgSchema.sync.modelName,
					modelId: orgSchema.sync.modelId,
					id: max(orgSchema.sync.id),
					action: orgSchema.sync.action,
				})
				.from(orgSchema.sync)
				.where(
					and(
						eq(orgSchema.sync.modelName, "issue"),
						inArray(orgSchema.sync.modelId, payload.ids),
					),
				)
				.groupBy(orgSchema.sync.modelName, orgSchema.sync.modelId);

			return syncData.map((syncItem) => ({
				...syncItem,
				data: null,
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

	.get(
		"/delta",
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
	)
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

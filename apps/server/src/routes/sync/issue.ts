import { arktypeValidator } from "@hono/arktype-validator";
import { and, eq } from "drizzle-orm";
import { createPrivateApp } from "@/auth/auth.factory";
import { db, dbSchema } from "@/db";
import { issueSchema } from "@/db/schema";
import { parseTanstackOptions } from "@/sync/tanstack-db/drizzle-adapter";
import { ParsedLoadSubsetOptions } from "@/sync/tanstack-db/types";

const app = createPrivateApp()
	.post("/", arktypeValidator("json", issueSchema.create), async (c) => {
		const payload = c.req.valid("json").map((item) => item.data);

		const syncData = await db.transaction(async (tx) => {
			const insertData = await tx
				.insert(dbSchema.issue)
				.values(payload)
				.returning();
			const syncData = await tx
				.insert(dbSchema.sync)
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
		const payload = c.req.valid("json");

		const syncData = await db.transaction(async (tx) => {
			const updateData = (
				await Promise.all(
					payload.map(({ id, data }) =>
						tx
							.update(dbSchema.issue)
							.set(data)
							.where(eq(dbSchema.issue.id, id))
							.returning(),
					) as unknown as [any, ...any[]],
				)
			).flat();
			console.log(
				updateData,
				updateData.map((data) => ({
					modelName: "issue",
					modelId: data.id,
					action: "update" as const,
					data: data,
				})),
			);

			const syncData = await tx
				.insert(dbSchema.sync)
				.values(
					updateData.map((data) => ({
						modelName: "issue",
						modelId: data.id,
						action: "update" as const,
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
	.get("/", arktypeValidator("query", ParsedLoadSubsetOptions), async (c) => {
		const query = c.req.valid("query");
		const parsedFilters = parseTanstackOptions(dbSchema.issue, query);

		let dbQuery = db.select().from(dbSchema.issue).$dynamic();
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

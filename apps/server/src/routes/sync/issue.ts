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
		const data = await db.insert(dbSchema.issue).values(payload).returning();
		return c.json(data, 201);
	})
	.patch("/", arktypeValidator("json", issueSchema.update), async (c) => {
		const payload = c.req.valid("json");

		const queries = payload.map(({ id, data }) =>
			db
				.update(dbSchema.issue)
				.set(data)
				.where(eq(dbSchema.issue.id, id))
				.returning(),
		);
		const data = (
			await db.batch(queries as unknown as [any, ...any[]])
		).flat() as Awaited<(typeof queries)[number]>;

		return c.json(data);
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

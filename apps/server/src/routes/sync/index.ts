import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq, gt, inArray } from "drizzle-orm";
import { createOrgApp } from "@/auth/org-auth.factory";
import { dbManager } from "@/db/db-manager";
import { orgModelConfig, orgSchema, orgSyncModels } from "@/db/schema-org";
import { handleSyncData } from "@/sync/handle-sync-data";
import { parseTanstackOptions } from "@/sync/tanstack-db/drizzle-adapter";
import { ParsedLoadSubsetOptions } from "@/sync/tanstack-db/types";

const app = createOrgApp()
	.post(
		"/cud",
		arktypeValidator(
			"json",
			type({
				modelId: "string",
				modelName: type.enumerated(...orgSyncModels),
				data: "unknown",
				action: "'insert' | 'update' | 'delete'",
			})
				.array()
				.atLeastLength(1),
		),
		async (c) => {
			const db = await dbManager.getOrgDb(c.get("organization").id);
			const payload = c.req.valid("json");

			type TItemPayload = (typeof payload)[number];
			type TGroupKeys =
				`${TItemPayload["action"]}-${TItemPayload["modelName"]}`;
			const groupedPayload = {} as Record<TGroupKeys, TItemPayload[]>;

			for (const itemPayload of payload) {
				const groupKey =
					`${itemPayload.action}-${itemPayload.modelName}` as const;

				if (itemPayload.action === "delete") {
					groupedPayload[groupKey] ??= [];
					groupedPayload[groupKey].push(itemPayload);
					continue;
				}

				const schema =
					orgModelConfig[itemPayload.modelName].schema[itemPayload.action];
				const data = schema(itemPayload.data);

				if (data instanceof type.errors) {
					console.error(data.summary);
					throw data;
				}
				groupedPayload[groupKey] ??= [];
				groupedPayload[groupKey].push({ ...itemPayload, data });
			}

			const groupedKeys = Object.keys(groupedPayload) as TGroupKeys[];
			let modelDbData: unknown[];
			if (
				groupedKeys.length === 1 &&
				(groupedKeys[0]!.startsWith("update")
					? groupedKeys[0]!.length === 1
					: true)
			) {
				const groupKey = groupedKeys[0]!;
				// const [action, modelName] = groupKey.split(/-(.*s?)/) as [
				//   TItemPayload["action"],
				//   TItemPayload["modelName"],
				// ];
				const payloadArray = groupedPayload[groupKey]!;
				const payloadItem = payloadArray[0]!;
				const action = payloadItem.action;
				const modelName = payloadItem.modelName;

				if (action === "insert") {
					modelDbData = db
						.insert(orgSchema[modelName])
						.values(payloadArray.map((p) => p.data as any))
						.returning()
						.all();
				} else if (action === "update") {
					modelDbData = payloadArray.flatMap((payloadItem) =>
						db
							.update(orgSchema[modelName])
							.set(payloadItem.data as any)
							.where(eq(orgSchema[modelName].id, payloadItem.modelId))
							.returning()
							.all(),
					);
				} else if (action === "delete") {
					db.delete(orgSchema[modelName])
						.where(
							inArray(
								orgSchema[modelName].id,
								payloadArray.map((i) => i.modelId),
							),
						)
						.run();
				}
			} else {
				modelDbData = db.transaction((tx) =>
					Object.values(groupedPayload).flatMap((payloadArray) => {
						const payloadItem = payloadArray[0]!;
						const action = payloadItem.action;
						const modelName = payloadItem.modelName;

						if (action === "insert") {
							return tx
								.insert(orgSchema[modelName])
								.values(payloadArray.map((p) => p.data as any))
								.returning()
								.all();
						}
						if (action === "update") {
							return payloadArray.flatMap((payloadItem) =>
								tx
									.update(orgSchema[modelName])
									.set(payloadItem.data as any)
									.where(eq(orgSchema[modelName].id, payloadItem.modelId))
									.returning()
									.all(),
							);
						}
						if (action === "delete") {
							tx.delete(orgSchema[modelName])
								.where(
									inArray(
										orgSchema[modelName].id,
										payloadArray.map((i) => i.modelId),
									),
								)
								.run();
							return [];
						}
					}),
				);
			}

			return handleSyncData("issue", modelDbData, c);
		},
	)
	.post("/", arktypeValidator("json", issueSchema.create), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json").map((item) => item.data);

		const modelDbData = db
			.insert(orgSchema.issue)
			.values(payload)
			.returning()
			.all();

		return handleSyncData("issue", modelDbData, c);
	})
	.patch("/", arktypeValidator("json", issueSchema.update), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json");

		const modelDbData = db.transaction((tx) => {
			return payload.flatMap(({ id, data }) =>
				tx
					.update(orgSchema.issue)
					.set(data)
					.where(eq(orgSchema.issue.id, id))
					.returning()
					.all(),
			);
		});

		return handleSyncData("issue", modelDbData, c);
	})
	.delete("/", arktypeValidator("json", issueSchema.delete), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json");

		db.delete(orgSchema.issue)
			.where(
				inArray(
					orgSchema.issue.id,
					payload.map((i) => i.id),
				),
			)
			.run();

		return handleSyncData("issue", [], c);
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

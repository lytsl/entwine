import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq, gt, inArray } from "drizzle-orm";
import { createOrgApp } from "@/auth/org-auth.factory";
import { dbManager } from "@/db/db-manager";
import {
	orgModelConfigs,
	orgSchema,
	type TOrgSyncModel,
} from "@/db/schema-org";
import {
	type CudTypes,
	CudValidationSchema,
	handleSyncData,
} from "@/sync/handle-sync-data";

const app = createOrgApp()
	.post("/cud", arktypeValidator("json", CudValidationSchema), async (c) => {
		const db = await dbManager.getOrgDb(c.get("organization").id);
		const payload = c.req.valid("json");

		const groupedPayload = {} as CudTypes["GroupedPayload"];

		for (const itemPayload of payload) {
			const groupKey =
				`${itemPayload.action}-${itemPayload.modelName}` as const;

			if (itemPayload.action === "delete") {
				groupedPayload[groupKey] ??= [];
				groupedPayload[groupKey].push(itemPayload);
				continue;
			}

			const schema =
				orgModelConfigs[itemPayload.modelName].schema[itemPayload.action];
			const data = schema(itemPayload.data);

			if (data instanceof type.errors) {
				console.error(data.summary);
				throw data;
			}
			groupedPayload[groupKey] ??= [];
			groupedPayload[groupKey].push({ ...itemPayload, data });
		}

		const groupedKeys = Object.keys(groupedPayload) as CudTypes["GroupKeys"][];
		let modelDbData: { id: string }[];
		if (
			groupedKeys.length === 1 &&
			(groupedKeys[0]!.startsWith("update")
				? groupedKeys[0]!.length === 1
				: true)
		) {
			const groupKey = groupedKeys[0]!;
			const payloadArray = groupedPayload[groupKey]!;
			const payloadItem = payloadArray[0]!;
			const action = payloadItem.action;
			const modelName = payloadItem.modelName;

			// TODO: implement hooks
			if (action === "insert") {
				modelDbData = db
					.insert(orgSchema[modelName])
					.values(payloadArray.map((p) => p.data as any))
					.returning()
					.all();
			} else if (action === "update") {
				// TODO: group by payloadItem.data
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
				modelDbData = [];
			} else {
				throw new Error(`Invalid action: ${action}`);
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
					throw new Error(`Invalid action: ${action}`);
				}),
			);
		}

		return await handleSyncData(payload, modelDbData, c);
	})
	.get(
		"/delta",
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

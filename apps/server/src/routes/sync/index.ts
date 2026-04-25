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

		const actionToHookName = {
			insert: "Create",
			update: "Update",
			delete: "Delete",
		} as const;

		const hashData = (data: any) =>
			JSON.stringify(Object.entries(data || {}).sort());

		type PreparedTask = { modelName: (typeof payload)[number]["modelName"] } & (
			| { type: "insert"; data: any[] }
			| { type: "update"; data: any; ids: string[] }
			| { type: "delete"; ids: string[] }
		);

		const taskMap = new Map<string, PreparedTask>();

		for (const itemPayload of payload) {
			const { action, modelName, modelId } = itemPayload;

			if (action === "delete") {
				const key = `delete-${modelName}`;
				if (!taskMap.has(key)) {
					taskMap.set(key, { type: "delete", modelName, ids: [] });
				}
				(
					taskMap.get(key) as Extract<PreparedTask, { type: "delete" }>
				).ids.push(modelId);
				continue;
			}

			const schema = orgModelConfigs[modelName].schema[action];
			const data = schema(itemPayload.data);

			if (data instanceof type.errors) {
				console.error(data.summary);
				throw data;
			}

			if (action === "insert") {
				const key = `insert-${modelName}`;
				if (!taskMap.has(key)) {
					taskMap.set(key, { type: "insert", modelName, data: [] });
				}
				(
					taskMap.get(key) as Extract<PreparedTask, { type: "insert" }>
				).data.push(data);
			} else if (action === "update") {
				const hash = hashData(data);
				const key = `update-${modelName}-${hash}`;

				if (!taskMap.has(key)) {
					taskMap.set(key, { type: "update", modelName, data, ids: [] });
				}
				(
					taskMap.get(key) as Extract<PreparedTask, { type: "update" }>
				).ids.push(modelId);
			}
		}

		const preparedTasks = Array.from(taskMap.values());

		for (const task of preparedTasks) {
			const hookSuffix = actionToHookName[task.type];
			const hook =
				orgModelConfigs[task.modelName].hooks?.[`before${hookSuffix}`];

			if (hook) {
				// Pass the task so the hook can mutate task.data if needed
				hook(task);
			}
		}

		const executeTask = (tx: typeof db, task: PreparedTask) => {
			const table = orgSchema[task.modelName];
			const hookSuffix = actionToHookName[task.type];
			const hooks = orgModelConfigs[task.modelName].hooks || {};

			if (hooks[`txBefore${hookSuffix}`]) {
				hooks[`txBefore${hookSuffix}`](task, tx);
			}

			let result;
			if (task.type === "insert") {
				result = tx.insert(table).values(task.data).returning().all();
			} else if (task.type === "update") {
				result = tx
					.update(table)
					.set(task.data)
					.where(inArray(table.id, task.ids))
					.returning()
					.all();
			} else if (task.type === "delete") {
				tx.delete(table).where(inArray(table.id, task.ids)).run();
				result = [];
			}

			if (hooks[`txAfter${hookSuffix}`]) {
				hooks[`txAfter${hookSuffix}`](result, task, tx);
			}

			(task as any).dbResult = result;
			return result || [];
		};

		let modelDbData: { id: string }[];

		if (preparedTasks.length === 1) {
			modelDbData = executeTask(db, preparedTasks[0]!);
		} else if (preparedTasks.length > 1) {
			modelDbData = db.transaction((tx) =>
				preparedTasks.flatMap((task) => executeTask(tx as any, task)),
			);
		} else {
			modelDbData = [];
		}

		for (const task of preparedTasks) {
			const hookSuffix = actionToHookName[task.type];
			const hook =
				orgModelConfigs[task.modelName].hooks?.[`after${hookSuffix}`];

			if (hook) {
				hook((task as any).dbResult, task);
			}
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

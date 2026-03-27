import type { WithRequired } from "@entwine/utility/types";
import {
	type CollectionConfig,
	type DeleteMutationFnParams,
	type InsertMutationFnParams,
	type LoadSubsetOptions,
	parseLoadSubsetOptions,
	type SyncConfig,
	TanStackDBError,
	type UpdateMutationFnParams,
	type UtilsRecord,
} from "@tanstack/db";
import { Store } from "@tanstack/react-store";
import type { DBSchema, IDBPDatabase } from "idb";
import type { z } from "zod";
import { api } from "@/utils/api";
import type { MessageListener, WebSocketClient } from "./ws-client";

interface WebSocketCollectionConfig<
	TModelName extends string,
	TModel extends object = Record<string, unknown>,
> extends Omit<
		WithRequired<CollectionConfig<TModel, string, z.ZodType<TModel>>, "schema">,
		"onInsert" | "onUpdate" | "onDelete" | "sync" | "id"
	> {
	wsClient: WebSocketClient;
	modelName: TModelName;
	apiPath: string;

	db: IDBPDatabase;
}

interface WebSocketUtils extends UtilsRecord {}

export class TrailBaseDBCollectionError extends TanStackDBError {
	constructor(message: string) {
		super(message);
		this.name = "TrailBaseDBCollectionError";
	}
}

export class TimeoutWaitingForIdsError extends TrailBaseDBCollectionError {
	constructor(ids: string | number) {
		super(`Timeout waiting for ids: ${ids}`);
		this.name = "TimeoutWaitingForIdsError";
	}
}

export function webSocketCollectionOptions<
	TModelName extends string,
	TModel extends object = Record<string, unknown>,
>(
	config: WebSocketCollectionConfig<TModelName, TModel>,
): WithRequired<
	CollectionConfig<TModel, string, z.ZodType<TModel>>,
	"schema"
> & {
	utils: WebSocketUtils;
} {
	const lastSyncId = new Store(0);
	const db = config.db;

	type TMetadataDb = IDBPDatabase<
		DBSchema &
			Record<
				"metadata",
				{
					key: string;
					value: { lastSyncId: number };
				}
			>
	>;
	type TModelDb = IDBPDatabase<
		DBSchema & Record<TModelName, { key: string; value: TModel }>
	>;

	// const lastSyncIdSubscription = lastSyncId.subscribe(async (value) => {
	//   await (db as TMetadataDb).put(
	//     metadataName,
	//     { lastSyncId: value },
	//     config.modelName,
	//   );
	// });

	const awaitLastSyncId = (
		syncId: number,
		timeout: number = 120 * 1000,
	): Promise<void> => {
		if (typeof syncId !== "number") {
			console.error("Invalid last sync id", syncId);
			return Promise.resolve();
		}
		const completed = (lastSyncId: number) => lastSyncId >= syncId;
		if (completed(lastSyncId.state)) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				unsubscribe();
				reject(new TimeoutWaitingForIdsError(syncId));
			}, timeout);

			const { unsubscribe } = lastSyncId.subscribe((value) => {
				if (completed(value)) {
					clearTimeout(timeoutId);
					unsubscribe();
					resolve();
				}
			});
		});
	};

	const sync: SyncConfig<TModel, string>["sync"] = (params) => {
		const { begin, write, commit, markReady } = params;

		const onMessage: MessageListener<TModel> = async (data) => {
			begin();
			const tx = db.transaction([config.modelName, "metadata"], "readwrite");
			const modelStore = tx.objectStore(config.modelName);
			const metadataStore = tx.objectStore("metadata");

			await Promise.all(
				[
					data.sync.map((item) => {
						write({
							type: item.action,
							value: item.data,
						});

						switch (item.action) {
							case "insert":
								return modelStore.add(item.data);
							case "update":
								return modelStore.put(item.data);
							case "delete":
								return modelStore.delete((item.data as any).id);
						}
					}),
					metadataStore.put({ lastSyncId: data.lastSyncId }, "metadata"),
					tx.done,
				].flat(),
			);

			lastSyncId.setState(() => data.lastSyncId);
			commit();
		};

		config.wsClient.addMessageListener(
			{ modelName: config.modelName },
			onMessage,
		);

		(db as TMetadataDb).get("metadata", "metadata").then((metadata) => {
			const lastSyncIdFromDb = metadata?.lastSyncId ?? 0;
			if (typeof lastSyncIdFromDb === "number") {
				lastSyncId.setState(() => lastSyncIdFromDb);
			}

			api
				.get(`${config.apiPath}/delta`, {
					searchParams: { lastSyncId: lastSyncIdFromDb },
				})
				.then(async (response) => {
					const sync: any = await response.json();
					if (Array.isArray(sync) && sync.length > 0) {
						onMessage({
							cmd: "sync",
							sync,
							lastSyncId: sync.reduce((acc, item) => Math.max(acc, item.id), 0),
						});
					}
					markReady();
				});
		});

		return {
			cleanup: () => {
				config.wsClient.removeMessageListener(
					{ modelName: config.modelName },
					onMessage,
				);
				// lastSyncIdSubscription.unsubscribe();
			},
			loadSubset: async (options: LoadSubsetOptions) => {
				const query = parseLoadSubsetOptions(options);

				const data = await db.getAll(config.modelName, undefined, query.limit);

				begin();
				if (Array.isArray(data)) {
					for (const item of data) {
						write({ type: "insert", value: item });
					}
				}
				commit();
			},
		};
	};

	const onInsert = async (params: InsertMutationFnParams<TModel, string>) => {
		const data = await api
			.post(config.apiPath, {
				json: params.transaction.mutations.map((mutation) => ({
					data: mutation.modified,
				})),
			})
			.json<{ lastSyncId: number }>();
		awaitLastSyncId(data?.lastSyncId);
	};

	const onUpdate = async (params: UpdateMutationFnParams<TModel, string>) => {
		const data = await api
			.patch(config.apiPath, {
				json: params.transaction.mutations.map((mutation) => ({
					id: mutation.key,
					data: mutation.changes,
				})),
			})
			.json<{ lastSyncId: number }>();
		awaitLastSyncId(data?.lastSyncId);
	};

	const onDelete = async (params: DeleteMutationFnParams<TModel, string>) => {
		const data = await api
			.patch(config.apiPath, {
				json: params.transaction.mutations.map((mutation) => ({
					id: mutation.key,
				})),
			})
			.json<{ lastSyncId: number }>();
		awaitLastSyncId(data?.lastSyncId);
	};

	return {
		id: config.modelName,
		schema: config.schema,
		getKey: config.getKey,
		sync: { sync },
		onInsert,
		onUpdate,
		onDelete,
		utils: {},
		syncMode: config.syncMode,
		// syncMode: "on-demand",
	};
}

import type { WithRequired } from "@entwine/utility/types";
import {
	type CollectionConfig,
	createCollection,
	type DeleteMutationFnParams,
	eq,
	type InsertMutationFnParams,
	type LoadSubsetOptions,
	parseLoadSubsetOptions,
	type SyncConfig,
	type UpdateMutationFnParams,
	type UtilsRecord,
} from "@tanstack/db";
import { z } from "zod";
import {
	honoClient,
	type SyncableModels,
	type SyncableModelType,
	wsSyncClient,
} from "@/utils/api";
import type { MessageListener, WebSocketClient, WsSyncData } from "./ws-client";
import { useLiveQuery } from "@tanstack/react-db";

interface WebSocketCollectionConfig<TModelName extends SyncableModels>
	extends Omit<
		WithRequired<
			CollectionConfig<
				SyncableModelType<TModelName>,
				SyncableModelType<TModelName>["id"],
				z.ZodType<SyncableModelType<TModelName>>
			>,
			"schema"
		>,
		"onInsert" | "onUpdate" | "onDelete" | "sync" | "id"
	> {
	wsClient: WebSocketClient;
	modelName: TModelName;
	syncMode: "on-demand";

	// Note: onInsert/onUpdate/onDelete are handled by the WebSocket connection
	// Users don't provide these handlers
}

interface WebSocketUtils extends UtilsRecord {}

export function webSocketCollectionOptions<TModelName extends SyncableModels>(
	config: WebSocketCollectionConfig<TModelName>,
): WithRequired<
	CollectionConfig<
		SyncableModelType<TModelName>,
		SyncableModelType<TModelName>["id"],
		z.ZodType<SyncableModelType<TModelName>>
	>,
	"schema"
> & { utils: WebSocketUtils } {
	type TItem = SyncableModelType<TModelName>;
	type TKey = SyncableModelType<TModelName>["id"];
	const apiPath = honoClient.sync[config.modelName];

	const sync: SyncConfig<TItem, TKey>["sync"] = (params) => {
		const { begin, write, commit, markReady } = params;

		const onMessage: MessageListener<TModelName> = (
			data: WsSyncData<TModelName>[],
		) => {
			begin();
			for (const item of data) {
				switch (item.action) {
					// case "sync":
					//   // Initial sync with array of items
					//   begin();
					//   if (Array.isArray(message.data)) {
					//     for (const item of message.data) {
					//       write({ type: "insert", value: item });
					//     }
					//   }
					//   commit();
					//   markReady();
					//   break;

					case "insert":
					case "update":
					case "delete":
						// Real-time updates from other clients
						write({
							type: item.action,
							value: item.data,
						});
						break;

					// case "ack":
					//   // Server acknowledged our transaction
					//   if (message.transactionId) {
					//     const pending = pendingTransactions.get(message.transactionId);
					//     if (pending) {
					//       clearTimeout(pending.timeout);
					//       pendingTransactions.delete(message.transactionId);
					//       pending.resolve();
					//     }
					//   }
					//   break;

					// case "transaction":
					//   // Server sending back the actual data after processing our transaction
					//   if (message.mutations) {
					//     begin();
					//     for (const mutation of message.mutations) {
					//       write({
					//         type: mutation.type,
					//         value: mutation.data,
					//       });
					//     }
					//     commit();
					//   }
					//   break;
				}
			}
			commit();
		};

		config.wsClient.addMessageListener(
			{ modelName: config.modelName },
			onMessage,
		);

		markReady();

		return {
			cleanup: () => {
				config.wsClient.removeMessageListener(
					{ modelName: config.modelName },
					onMessage,
				);
			},
			loadSubset: async (options: LoadSubsetOptions) => {
				const query: any = parseLoadSubsetOptions(options);
				const response = await apiPath.$get({ query });
				const data = await response.json();
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

	const onInsert = async (params: InsertMutationFnParams<TItem, TKey>) => {
		params.transaction.mutations[0]!.type;
		await apiPath.$post({
			json: params.transaction.mutations.map((mutation) => ({
				data: mutation.modified,
			})),
		});
	};

	const onUpdate = async (params: UpdateMutationFnParams<TItem, TKey>) => {
		await apiPath.$patch({
			json: params.transaction.mutations.map((mutation) => ({
				id: mutation.key,
				data: mutation.changes,
			})),
		});
	};

	const onDelete = async (_params: DeleteMutationFnParams<TItem, TKey>) => {
		throw new Error("Not implemented");
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
		syncMode: "on-demand",
	};
}

export const issueCollection = createCollection(
	webSocketCollectionOptions({
		wsClient: wsSyncClient,
		getKey: (todo) => todo.id,
		schema: z.object({
			id: z.string(),
			title: z.string(),
			description: z.string(),
			rank: z.string(),
		}),
		modelName: "issue",
		syncMode: "on-demand",
	}),
);

export const useCollectionData = () =>
	useLiveQuery((q) =>
		q
			.from({ issue: issueCollection })
			.orderBy(({ issue }) => issue.rank, "asc")
			.limit(10),
	);

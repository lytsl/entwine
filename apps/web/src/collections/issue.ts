import { parseLoadSubsetOptions } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { api } from "@/utils/api";
import { queryClient } from "@/utils/query-client";

export const issueCollection = createCollection(
	queryCollectionOptions({
		id: "issue",
		queryKey: ["issue"],
		queryClient,
		getKey: (item: any) => item.id,
		syncMode: "on-demand", // Enable predicate push-down
		queryFn: async (ctx) => {
			const query: any = parseLoadSubsetOptions(ctx?.meta?.loadSubsetOptions);
			const response = await api.api.sync.issue.$get.call({
				query: JSON.stringify({
					...ctx?.meta?.loadSubsetOptions,
					...query,
				}) as any,
			});
			if (response.ok) {
				const json = await response.json();
				return json.map((d) => ({
					...d,
					// createdAt: new Date(d.createdAt),
					// updatedAt: new Date(d.updatedAt),
					// deletedAt: d.deletedAt ? new Date(d.deletedAt) : null,
					// dueDate: d.dueDate ? new Date(d.dueDate) : null,
				}));
			}
			throw new Error("FIXME");
		},
		onInsert: async ({ transaction }) => {
			const newItems = transaction.mutations.map((m) => m.modified);

			// Send to server and get back items with server-computed fields
			const serverItems = await api.api.sync.issue.$post
				.call({
					json: newItems,
				})
				.then(async (response) => {
					const json = await response.json();
					return json.map((d) => ({
						...d,
						// createdAt: new Date(d.createdAt),
						// updatedAt: new Date(d.updatedAt),
						// deletedAt: d.deletedAt ? new Date(d.deletedAt) : null,
						// dueDate: d.dueDate ? new Date(d.dueDate) : null,
					}));
				});

			// Sync server-computed fields (like server-generated IDs, timestamps, etc.)
			// to the collection's synced data store
			issueCollection.utils.writeBatch(() => {
				serverItems.forEach((serverItem) => {
					issueCollection.utils.writeInsert(serverItem);
				});
			});

			// Skip automatic refetch since we've already synced the server response
			// (optimistic state is automatically replaced when handler completes)
			return { refetch: false };
		},

		onUpdate: async ({ transaction }) => {
			const updates = transaction.mutations.map((m) => ({
				id: m.key,
				changes: m.changes,
			}));
			const serverItems = await api.api.sync.issue.$patch
				.call({
					json: updates,
				})
				.then(async (response) => {
					const json = await response.json();
					return json.map((d) => ({
						...d,
						// createdAt: new Date(d.createdAt),
						// updatedAt: new Date(d.updatedAt),
						// deletedAt: d.deletedAt ? new Date(d.deletedAt) : null,
						// dueDate: d.dueDate ? new Date(d.dueDate) : null,
					}));
				});

			// Sync server-computed fields from the update response
			issueCollection.utils.writeBatch(() => {
				serverItems.forEach((serverItem) => {
					issueCollection.utils.writeUpdate(serverItem);
				});
			});

			return { refetch: false };
		},
	}),
);

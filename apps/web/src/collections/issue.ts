import { createCollection } from "@tanstack/db";
import { useLiveQuery } from "@tanstack/react-db";
import z from "zod";
import { db } from "@/db";
import { webSocketCollectionOptions } from "@/lib/sync/tdb-collection";
import { wsSyncClient } from "@/utils/api";

export const issueCollection = createCollection(
	webSocketCollectionOptions({
		wsClient: wsSyncClient,
		getKey: (todo) => todo.id,
		schema: z.object({
			id: z.string().default(() => crypto.randomUUID()),
			title: z.string(),
			description: z.string(),
			rank: z.string(),
		}),
		modelName: "issue",
		syncMode: "on-demand",
		apiPath: "sync/issue",
		db,
	}),
);

export const useCollectionData = () =>
	useLiveQuery((q) =>
		q
			.from({ issue: issueCollection })
			.orderBy(({ issue }) => issue.rank, "asc")
			.limit(10),
	);

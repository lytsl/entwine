import { createCollection } from "@tanstack/db";
import z from "zod";
import { webSocketCollectionOptions } from "@/lib/sync/tdb-collection";

export const issueCollection = createCollection(
	webSocketCollectionOptions({
		schema: z.object({
			id: z.string().default(() => crypto.randomUUID()),
			title: z.string(),
			description: z.string(),
			rank: z.string(),
		}),
		modelName: "issue",
	}),
);

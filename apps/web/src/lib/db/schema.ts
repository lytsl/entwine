import z from "zod";
import type { ZodDBSchemaDef } from "../idb-wrapper";

export const idbSchema = {
	issue: {
		keyPath: "id",
		schema: z.object({
			id: z.string().default(() => crypto.randomUUID()),
			title: z.string(),
			description: z.string(),
		}),
	},
} satisfies ZodDBSchemaDef;

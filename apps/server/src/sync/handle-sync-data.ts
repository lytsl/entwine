import type { NonNullableFields } from "@entwine/utility/types";
import { and, eq, inArray, max } from "drizzle-orm";
import type { Context } from "hono";
import type { BunWebSocketData } from "hono/bun";
import type { auth } from "@/auth/better-auth";
import { dbManager } from "@/db/db-manager";
import { orgSchema } from "@/db/schema-org";

export async function handleSyncData<Model extends { id: string }>(
	modelName: string,
	modelDbData: Model[],
	c: Context<{
		Variables: NonNullableFields<typeof auth.$Infer.Session>;
		Bindings: {
			server: Bun.Server<BunWebSocketData>;
		};
	}>,
) {
	const db = await dbManager.getOrgDb(c.get("organization").id);

	const syncDbData = db
		.select({
			modelName: orgSchema.sync.modelName,
			modelId: orgSchema.sync.modelId,
			id: max(orgSchema.sync.id),
			action: orgSchema.sync.action,
		})
		.from(orgSchema.sync)
		.where(
			and(
				eq(orgSchema.sync.modelName, modelName),
				inArray(
					orgSchema.sync.modelId,
					modelDbData.map((item) => item.id),
				),
			),
		)
		.groupBy(orgSchema.sync.modelName, orgSchema.sync.modelId)
		.all();

	const syncData = syncDbData.map((syncItem) => ({
		...syncItem,
		data: modelDbData.find((item) => item.id === syncItem.modelId),
	}));

	const lastSyncId = syncData.reduce(
		(mx, item) => Math.max(mx, item?.id ?? 0),
		0,
	);
	c.env.server.publish(
		"org",
		JSON.stringify({
			cmd: "sync",
			sync: syncData,
			lastSyncId,
		}),
	);

	return c.json({ lastSyncId }, 201);
}

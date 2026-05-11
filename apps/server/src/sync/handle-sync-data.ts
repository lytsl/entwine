import type { NonNullableFields } from "@entwine/utility/types";
import { type } from "arktype";
import { and, eq, inArray, max, or } from "drizzle-orm";
import type { Context } from "hono";
import type { BunWebSocketData } from "hono/bun";
import type { auth } from "@/auth/better-auth";
import { dbManager } from "@/db/db-manager";
import orgSchema, { orgSyncModels } from "@/db/schema-org";

export const CudValidationSchema = type({
  modelId: "string",
  modelName: type.enumerated(...orgSyncModels),
  data: "unknown",
  action: "'insert' | 'update' | 'delete'",
})
  .array()
  .atLeastLength(1);

type TCudPayload = typeof CudValidationSchema.inferOut;
type TItemPayload = TCudPayload[number];
type TGroupKeys = `${TItemPayload["action"]}-${TItemPayload["modelName"]}`;

export type CudTypes = {
  Payload: TCudPayload;
  GroupKeys: TGroupKeys;
  GroupedPayload: Record<TGroupKeys, TItemPayload[]>;
};

export async function handleSyncData(
  payload: CudTypes["Payload"],
  modelDbData: { id: string }[],
  c: Context<{
    Variables: NonNullableFields<typeof auth.$Infer.Session>;
    Bindings: {
      server: Bun.Server<BunWebSocketData>;
    };
  }>,
) {
  const db = await dbManager.getOrgDb(c.get("organization").id);

  const syncDbData = db
    .insert(orgSchema.Sync)
    .values(
      payload.map((p) => ({
        modelId: p.modelId,
        modelName: p.modelName,
        action: p.action,
      })),
    )
    .returning()
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

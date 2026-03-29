import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq, gt, inArray, max, notInArray } from "drizzle-orm";
import { createPrivateApp } from "@/auth/auth.factory";
import { dbManager } from "@/db/db-manager";
import orgSchema from "@/db/schema-org";
import { issueSchema } from "@/db/schema-org/issue";
import { parseTanstackOptions } from "@/sync/tanstack-db/drizzle-adapter";
import { ParsedLoadSubsetOptions } from "@/sync/tanstack-db/types";

const app = createPrivateApp().get(
  "/",
  arktypeValidator("query", type({ lastSyncId: "string.integer.parse" })),
  async (c) => {
    const db = await dbManager.getOrgDb(c.get("organization").id);
    const { lastSyncId } = c.req.valid("query");

    const dbSyncData = await db
      .select()
      .from(orgSchema.sync)
      .where(
        and(
          eq(orgSchema.sync.modelName, "issue"),
          gt(orgSchema.sync.id, lastSyncId),
        ),
      );

    const filteredSyncData: typeof dbSyncData = [];
    dbSyncData.forEach((item) => {
      const existingItemIndex = filteredSyncData.findIndex(
        (existing) =>
          existing.modelName === item.modelName &&
          existing.modelId === item.modelId,
      );
      if (existingItemIndex >= 0) {
        if (item.id > dbSyncData[existingItemIndex]!.id) {
          filteredSyncData[existingItemIndex] = item;
        }
      } else {
        filteredSyncData.push(item);
      }
    });

    const issueData = await db
      .select()
      .from(orgSchema.issue)
      .where(
        inArray(
          orgSchema.issue.id,
          filteredSyncData.map((item) => item.modelId),
        ),
      );

    const data = filteredSyncData.map((syncItem) => ({
      ...syncItem,
      data: issueData.find((item) => item.id === syncItem.modelId),
    }));

    return c.json(data, 200);
  },
);
export default app;

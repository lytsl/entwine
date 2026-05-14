import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export enum SyncActionEnum {
  Insert = "insert",
  Update = "update",
  Delete = "delete",
}

export const Sync = sqliteTable(
  "sync",
  {
    id: integer("id").primaryKey({ autoIncrement: false }).notNull(),
    modelName: text("model_name").notNull(),
    modelId: text("model_id").notNull(),
    action: text("action", {
      enum: [
        SyncActionEnum.Insert,
        SyncActionEnum.Update,
        SyncActionEnum.Delete,
      ],
    }).notNull(),
  },
  (table) => [index("sync_model_idx").on(table.modelName, table.modelId)],
);

export const EntitySequence = sqliteTable(
  "entity_sequence",
  {
    entityName: text("entity_name").notNull(),
    entityId: text("entity_id").notNull(),
    sequence: integer("sequence").notNull(),
  },
  (table) => [primaryKey({ columns: [table.entityName, table.entityId] })],
);

export default { EntitySequence, Sync };

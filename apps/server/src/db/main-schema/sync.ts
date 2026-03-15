import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import { organization } from "./auth";
import { defineRelations } from "drizzle-orm";

export const sync = sqliteTable(
  "sync",
  {
    id: integer("id"),
    modelName: text("model_name").notNull(),
    modelId: text("model_id").notNull(),
    action: text("action", { enum: ["insert", "update", "delete"] }).notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    // 2. Keep the composite Primary Key and Unique constraints
    primaryKey({ columns: [table.id, table.organizationId] }),
    unique().on(table.modelName, table.modelId),
  ],
);

export default { sync };

export const relations = defineRelations({ sync, organization }, (r) => ({
  organization: {
    sync: r.many.sync(),
  },
  sync: {
    organization: r.one.organization({
      from: r.sync.organizationId,
      to: r.organization.id,
    }),
  },
}));

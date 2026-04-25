import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

const Sync = sqliteTable(
	"sync",
	{
		id: integer("id").primaryKey({ autoIncrement: false }).notNull(),
		modelName: text("model_name").notNull(),
		modelId: text("model_id").notNull(),
		action: text("action", { enum: ["insert", "update", "delete"] }).notNull(),
	},
	(table) => [index("sync_model_idx").on(table.modelName, table.modelId)],
);

const EntitySequence = sqliteTable(
	"entity_sequence",
	{
		entityName: text("entity_name").notNull(),
		entityId: text("entity_id").notNull(),
		seq: integer("seq").notNull(),
	},
	(table) => [primaryKey({ columns: [table.entityName, table.entityId] })],
);

export default { EntitySequence, Sync };

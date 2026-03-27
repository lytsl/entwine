import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sync = sqliteTable(
	"sync",
	{
		id: integer("id").primaryKey({ autoIncrement: false }).notNull(),
		modelName: text("model_name").notNull(),
		modelId: text("model_id").notNull(),
		action: text("action", { enum: ["insert", "update", "delete"] }).notNull(),
	},
	(table) => [index("sync_model_idx").on(table.modelName, table.modelId)],
);

export default { sync };

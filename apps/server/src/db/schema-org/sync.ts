import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const sync = sqliteTable(
	"sync",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		modelName: text("model_name").notNull(),
		modelId: text("model_id").notNull(),
		action: text("action", { enum: ["insert", "update", "delete"] }).notNull(),
	},
	(table) => [unique().on(table.modelName, table.modelId)],
);

export default { sync };

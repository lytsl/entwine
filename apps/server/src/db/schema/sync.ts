import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// export interface WsSyncData<TModelName extends SyncableModels> {
// 	id: number;
// 	modelName: TModelName;
// 	modelId: string;
// 	action: "insert" | "update" | "delete";
// 	data: SyncableModelType<TModelName>;
// 	// transactionId?: string;
// }

export const sync = sqliteTable("sync", {
	id: integer().primaryKey({ autoIncrement: true }),
	modelName: text().notNull(),
	modelId: text().notNull(),
	action: text({ enum: ["insert", "update", "delete"] }).notNull(),
	data: text({ mode: "json" }).notNull(),
	// createdAt: integer("created_at", { mode: "timestamp_ms" })
	//   .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
	//   .notNull(),
});

import { defineRelations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { customJson } from "../utils/custom-drizzle-types";

export const team = sqliteTable("team", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$onUpdate(
		() => /* @__PURE__ */ new Date(),
	),
	slug: text("slug").notNull(),
	metadata: customJson<{ color: string; emoji: string }>("metadata").notNull(),
});

export const teamMember = sqliteTable(
	"team_member",
	{
		id: text("id").primaryKey(),
		teamId: text("team_id")
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		// .references(() => user.id, { onDelete: "cascade" }),  // TODO: Handle this
		createdAt: integer("created_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("teamMember_teamId_idx").on(table.teamId),
		index("teamMember_userId_idx").on(table.userId),
	],
);

const schema = {
	team,
	teamMember,
};
export default schema;
export const relations = defineRelations(schema, (r) => ({
	team: {
		teamMembers: r.many.teamMember(),
	},
	teamMember: {
		team: r.one.team({
			from: r.teamMember.teamId,
			to: r.team.id,
		}),
	},
}));

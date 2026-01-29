import { getTableColumns, type Table } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-typebox";
import Type from "typebox";

// const userInsertSchema = createInsertSchema(users, {
//   // We can now use the extended instance
//   name: (schema) => t.Number({ ...schema }, { error: '`name` must be a string' })
// });
export const schemaFactory = createSchemaFactory({ typeboxInstance: Type });

export function createSchema<TTable extends Table>(table: TTable) {
	const columns = getTableColumns(table);
	// console.log(util.inspect(columns, {showHidden: false, depth: null, colors: true}));

	const refinements: Parameters<typeof schemaFactory.createInsertSchema>[1] =
		{};

	for (const [key, column] of Object.entries(columns)) {
		const fieldConfig = (column as any)?.config?.fieldConfig;

		if (fieldConfig?.typebox) {
			const { typebox, ...config } = fieldConfig;
			refinements[key] = (schema: any) => {
				return { ...schema, ...config };
			};
		}
	}

	return {
		create: schemaFactory.createInsertSchema(table, refinements as any),
		update: schemaFactory.createUpdateSchema(table),
		select: schemaFactory.createSelectSchema(table),
	};
}

import { customType } from "drizzle-orm/sqlite-core";

export type customTextConfig = Parameters<typeof Type.String>[0];
export function customText(config: customTextConfig) {
	if (config) config["typebox"] = true;
	return customType<{ data: string; config: customTextConfig }>({
		dataType() {
			return "text";
		},
	})(config);
}

import type { TSchema } from "@entwine/typebox";
import type {
	ColumnBaseConfig,
	ColumnBuilderBaseConfig,
	ColumnDataType,
} from "drizzle-orm";
import { SQLiteColumn, SQLiteColumnBuilder } from "drizzle-orm/sqlite-core";

declare module "drizzle-orm/sqlite-core" {
	interface SQLiteColumnBuilder<
		T extends ColumnBuilderBaseConfig<ColumnDataType, string>,
	> {
		meta(metadata: Record<string, any>): this;
		typebox(schema: TSchema): this;
	}
	interface SQLiteColumn<T extends ColumnBaseConfig<ColumnDataType, string>> {
		readonly meta: Record<string, any> | undefined;
		readonly typebox: TSchema | undefined;
	}
}

SQLiteColumnBuilder.prototype.meta = function (metadata: Record<string, any>) {
	(this as any).config.meta = metadata;
	return this;
};
SQLiteColumnBuilder.prototype.typebox = function (schema: TSchema) {
	(this as any).config.typebox = schema;
	return this;
};

Object.defineProperty(SQLiteColumn.prototype, "meta", {
	get() {
		return (this as any).config?.meta;
	},
	configurable: true,
	enumerable: true,
});
Object.defineProperty(SQLiteColumn.prototype, "typebox", {
	get() {
		return (this as any).config?.typebox;
	},
	configurable: true,
	enumerable: true,
});

import type { Type } from "arktype";
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
		arktype(schema: Type): this;
	}
	interface SQLiteColumn<T extends ColumnBaseConfig<ColumnDataType, string>> {
		readonly meta: Record<string, any> | undefined;
		readonly arktype: Type | undefined;
	}
}

SQLiteColumnBuilder.prototype.meta = function (metadata: Record<string, any>) {
	(this as any).config.meta = metadata;
	return this;
};
SQLiteColumnBuilder.prototype.arktype = function (schema: Type) {
	(this as any).config.arktype = schema;
	return this;
};

Object.defineProperty(SQLiteColumn.prototype, "meta", {
	get() {
		return (this as any).config?.meta;
	},
	configurable: true,
	enumerable: true,
});
Object.defineProperty(SQLiteColumn.prototype, "arktype", {
	get() {
		return (this as any).config?.arktype;
	},
	configurable: true,
	enumerable: true,
});

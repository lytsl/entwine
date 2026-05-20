import type { ZodType } from "zod";
import type {
  ColumnBaseConfig,
  ColumnBuilderBaseConfig,
  ColumnBuilderExtraConfig,
  ColumnType,
} from "drizzle-orm";
import { SQLiteColumn, SQLiteColumnBuilder } from "drizzle-orm/sqlite-core";

declare module "drizzle-orm/sqlite-core" {
  interface SQLiteColumnBuilder<
    T extends ColumnBuilderBaseConfig<ColumnType> =
      ColumnBuilderBaseConfig<ColumnType>,
    TRuntimeConfig extends object = object,
    TExtraConfig extends ColumnBuilderExtraConfig = object,
  > {
    meta(
      metadata: { readOnly: true } | { validationSchema: ZodType } | undefined,
    ): this;
  }
  interface SQLiteColumn<
    T extends ColumnBaseConfig<ColumnType> = ColumnBaseConfig<ColumnType>,
    TRuntimeConfig extends object = {},
  > {
    readonly meta:
      | { readOnly: true }
      | { validationSchema: ZodType }
      | undefined;
  }
}

SQLiteColumnBuilder.prototype.meta = function (
  metadata: { readOnly: true } | { validationSchema: ZodType } | undefined,
) {
  (this as any).config.meta = metadata;
  return this;
};

Object.defineProperty(SQLiteColumn.prototype, "meta", {
  get() {
    return (this as any).config?.meta;
  },
  configurable: true,
  enumerable: true,
});

import { bigIntToBuffer, bufferToBigInt } from "@entwine/utility";
import { customType, SQLiteText } from "drizzle-orm/sqlite-core";
import Type from "typebox";
import { Typebox } from "..";

SQLiteText;

export const DbType = {
	Boolean: (options?: Type.TSchemaOptions) =>
		customType<{
			data: boolean;
			driverData: number;
		}>({
			dataType() {
				return "INTEGER";
			},
			toDriver(value) {
				return Number(value);
			},
			fromDriver(value) {
				return Boolean(value);
			},
		})({ typebox: Type.Boolean(options) }),
	String: (options?: Type.TStringOptions) =>
		customType<{ data: string }>({
			dataType() {
				return "TEXT";
			},
		})({ typebox: Type.String(options) }),
	DateTime: () =>
		customType<{ data: Date; driverData: number }>({
			dataType() {
				return "INTEGER";
			},
			toDriver(value) {
				return Number(value);
			},
			fromDriver(value) {
				return new Date(value);
			},
		})({ typebox: Typebox.DateTime() }),
	Date: (options?: Type.TStringOptions) =>
		customType<{
			data: string;
			driverData: string;
		}>({
			dataType() {
				return "TEXT";
			},
		})({ typebox: Type.String({ format: "date", ...options }) }),
	Enum: (values: readonly Type.TEnumValue[], options?: Type.TSchemaOptions) =>
		customType<{
			data: (typeof values)[number];
			driverData: string;
			config: Type.TStringOptions;
		}>({
			dataType() {
				return "TEXT";
			},
		})({ typebox: Type.Enum(values, options) }),
	Number: (options?: Type.TNumberOptions) =>
		customType<{
			data: number;
			driverData: number;
		}>({
			dataType() {
				return "REAL";
			},
		})({
			typebox: Type.Number({
				minimum: -140_737_488_355_328,
				maximum: 140_737_488_355_327,
				...options,
			}),
		}),
	Integer: (options?: Type.TNumberOptions) =>
		customType<{
			data: number;
			driverData: number;
		}>({
			dataType() {
				return "INTEGER";
			},
		})({
			typebox: Type.Integer({
				minimum: -9_007_199_254_740_991,
				maximum: 9_007_199_254_740_991,
				...options,
			}),
		}),
	BigInt: (options?: Type.TNumberOptions) =>
		customType<{
			data: bigint;
			driverData: Buffer;
		}>({
			dataType() {
				return "BLOB";
			},
			toDriver(value) {
				return bigIntToBuffer(value);
			},
			fromDriver(value) {
				return bufferToBigInt(value);
			},
		})({
			typebox: Type.BigInt({
				minimum: -9_223_372_036_854_775_808n,
				maximum: 9_223_372_036_854_775_807n,
				...options,
			}),
		}),
	Object: <Properties extends Type.TProperties>(
		properties: Properties,
		options: Type.TObjectOptions & { mode: "BLOB" | "TEXT" },
	) =>
		customType<{
			data: Properties;
			driverData: Buffer | string;
			config: { mode: "BLOB" | "TEXT" };
		}>({
			dataType(config) {
				return config?.mode || "TEXT";
			},
			toDriver(value) {
				const json = JSON.stringify(value);
				return options?.mode === "BLOB" ? Buffer.from(json) : json;
			},
			fromDriver(value) {
				if (Buffer.isBuffer(value)) {
					return JSON.parse(value.toString());
				}
				return JSON.parse(value);
			},
		})({
			typebox: Type.Object(properties, options),
			mode: options?.mode || "TEXT",
		}),
};

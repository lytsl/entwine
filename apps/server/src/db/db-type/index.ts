import { customType } from "drizzle-orm/sqlite-core";
import Type from "typebox";

Type.Boolean;

export const DbType = {
	Boolean: (config: Type.TSchemaOptions) =>
		customType<{
			data: boolean;
			driverData: number;
			config: Type.TSchemaOptions;
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
		})({ ...config, typebox: true }),
	String: (config: Type.TStringOptions) =>
		customType<{ data: string; config: Type.TStringOptions }>({
			dataType() {
				return "TEXT";
			},
		})({ ...config, typebox: true }),
	DateTime: (config: Type.TStringOptions) =>
		customType<{ data: Date; driverData: number; config: Type.TStringOptions }>(
			{
				dataType() {
					return "INTEGER";
				},
				toDriver(value) {
					return Number(value);
				},
				fromDriver(value) {
					return new Date(value);
				},
			},
		)({ ...config, typebox: true, format: "date-time" }),
	Date: (config: Type.TStringOptions) =>
		customType<{
			data: string;
			driverData: number;
			config: Type.TStringOptions;
		}>({
			dataType() {
				return "INTEGER";
			},
		})({ ...config, typebox: true, format: "date" }),
};

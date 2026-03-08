import { customType } from "drizzle-orm/sqlite-core";

export const customJson = <TData>(name: string) =>
	customType<{ data: TData; driverData: string }>({
		dataType() {
			return "text";
		},
		toDriver(value: TData): string {
			return typeof value === "string" ? value : JSON.stringify(value);
		},
		fromDriver(value) {
			return JSON.parse(value);
		},
	})(name);

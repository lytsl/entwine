import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "$schema",
	out: "$out",
	dialect: "sqlite",
	dbCredentials: {
		url: "$url",
	},
});

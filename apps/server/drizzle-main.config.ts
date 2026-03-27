import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { env } from "./env";

dotenv.config({
	path: ".env",
});

export default defineConfig({
	schema: "src/db/schema-main",
	out: "src/db/migrations-main",
	dialect: "sqlite",
	dbCredentials: {
		url: env.MAIN_DATABASE_PATH,
	},
});

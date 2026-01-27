import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
	path: ".env",
});

export default defineConfig({
	schema: "./src/db/schema",
	out: "./src/db/migrations",
	dialect: "turso",
	dbCredentials: {
		url: process.env.DATABASE_URL || "",
	},
});

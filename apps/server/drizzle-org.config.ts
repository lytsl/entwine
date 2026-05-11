import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";
import { env } from "./env";

dotenv.config({
  path: ".env",
});

export default defineConfig({
  schema: "src/db/schema-org",
  out: "src/db/migrations-org",
  dialect: "sqlite",
  dbCredentials: {
    url: env.ORG_DATABASE_PATH,
  },
});

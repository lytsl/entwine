/** biome-ignore-all lint/style/useConst: env */
import { ArkErrors, type } from "arktype";
import "dotenv/config";

const envSchema = type({
	NODE_ENV: "'development' | 'production' | 'test' = 'development'",
	PORT: "string.numeric.parse",
	DATABASE_URL: "string > 1",
	BETTER_AUTH_SECRET: "string >= 32",
	BETTER_AUTH_URL: "string.url",
	CORS_ORIGIN: "string.url",
});

const envParsed = envSchema(process.env);
export let env: typeof envSchema.inferOut;
if (envParsed instanceof ArkErrors) {
	throw envParsed[0]?.message;
}
env = envParsed;

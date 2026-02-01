/** biome-ignore-all lint/style/useConst: env */
import { ArkErrors, type } from "arktype";

const envSchema = type({
	VITE_SERVER_URL: "string.url",
});

const envParsed = envSchema(import.meta.env);
export let env: typeof envSchema.inferOut;
if (envParsed instanceof ArkErrors) {
	throw envParsed[0].throw();
}
env = envParsed;

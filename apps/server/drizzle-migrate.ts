import { parseArgs } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Config } from "drizzle-kit";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	options: {
		config: {
			type: "string",
		},
	},
});
const configFilePaths = values.config?.split(",");
if (!configFilePaths || configFilePaths.length === 0)
	throw new Error("config is required");

async function loadModule(filePath: string) {
	const resolvedPath = path.resolve(filePath);
	const fileUrl = pathToFileURL(resolvedPath).href;
	const module = await import(fileUrl);
	return module.default as Config;
}

for (const configFilePath of configFilePaths) {
	const config = await loadModule(configFilePath);
	if (config.dialect === "sqlite") {
		throw new Error("dialect must be sqlite");
	}

	const dbConfigPath = (config as any).dbCredentials.url;
	const dbPath = path.join(__dirname, dbConfigPath);

	const client = new Database(dbPath);
	const orgDb = drizzle({ client, schema: orgSchema });
}

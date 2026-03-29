import { Database } from "bun:sqlite";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import fs from "node:fs";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const { values } = parseArgs({
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
  const moduleDefault = module.default;
  return moduleDefault;
}

for (const configFilePath of configFilePaths) {
  const config = await loadModule(configFilePath);
  if (config.dialect !== "sqlite") {
    throw new Error("dialect must be sqlite");
  }

  const dbPath = path.join(__dirname, (config as any).dbCredentials.url);
  const dbDirectory = path.join(dbPath, "..");
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
  const client = new Database(dbPath);

  const schema = await loadModule((config as any).schema);

  const db = drizzle({ client, schema });

  const errorResponse = migrate(db, {
    migrationsFolder: path.join(__dirname, (config as any).out),
  });
  if (errorResponse) {
    console.error(errorResponse);
    throw new Error(`Error applying migration for ${configFilePath}`, {
      cause: errorResponse,
    });
  }
}

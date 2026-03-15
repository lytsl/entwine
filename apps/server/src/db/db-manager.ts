import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "../../env";
import mainSchema from "./schema-main";
import mainRelations from "./schema-main/relations";
import orgSchema from "./schema-org";
import { appRoot } from "@/utils/app-root";

const execAsync = promisify(exec);

class DatabaseManager {
	private client = createClient({ url: env.MAIN_DATABASE_URL });
	db = drizzle({
		client: this.client,
		schema: mainSchema,
		relations: mainRelations,
	});

	// Cache for organization-specific connections
	private tenantConnections = new Map<string, ReturnType<typeof drizzle>>();

	/**
	 * Retrieves or initializes a database connection for a specific organization.
	 */
	async getOrgDb(organizationId: string) {
		// Return cached connection if it exists
		if (this.tenantConnections.has(organizationId)) {
			return this.tenantConnections.get(organizationId)!;
		}

		const dbPath = path.join(
			appRoot,
			env.ORG_FOLDER_PATH,
			`${organizationId}.sqlite`,
		);
		const isNewDatabase = !fs.existsSync(dbPath);
		if (isNewDatabase) {
			fs.copyFileSync(path.join(appRoot, env.ORG_DATABASE_PATH), dbPath);
		} else {
			const configTemplate = fs.readFileSync(
				path.join(appRoot, "drizzle-org.template.ts"),
			);
			const orgConfig = configTemplate
				.toString()
				.replace("$url", `file:${dbPath}`)
				.replace("$schema", path.join(appRoot, "src/db/schema-org"))
				.replace("$out", path.join(appRoot, "src/db/migrations-org"));
			const configPath = path.join(
				appRoot,
				env.ORG_FOLDER_PATH,
				`${organizationId}.config.ts`,
			);
			fs.writeFileSync(configPath, orgConfig);
			await execAsync(
				`bunx drizzle-kit migrate --ignore-conflicts --config=${configPath}`,
			);
			console.log(
				`bunx drizzle-kit migrate --ignore-conflicts --config=${configPath}`,
			);
			// fs.unlinkSync(configPath);
		}

		const client = createClient({ url: `file:${dbPath}` });
		// client.pragma("journal_mode = WAL");

		const tenantDb = drizzle({ client, schema: orgSchema });

		// Cache the connection for future requests in the same lifecycle
		this.tenantConnections.set(organizationId, tenantDb);

		return tenantDb;
	}
}

// Export a single instance to be used throughout the app
export const dbManager = new DatabaseManager();

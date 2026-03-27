import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { appRoot } from "@/utils/app-root";
import { env } from "../../env";
import mainSchema from "./schema-main";
import mainRelations from "./schema-main/relations";
import orgSchema from "./schema-org";
import { createDrizzleExtension } from "./utils/sync-extension";

const execAsync = promisify(exec);

class DatabaseManager {
	private client = new Database(env.MAIN_DATABASE_PATH);
	db = drizzle({
		client: this.client,
		schema: mainSchema,
		relations: mainRelations,
	});

	private orgConnections = new Map<string, ReturnType<typeof drizzle>>();
	private pendingConnections = new Map<
		string,
		Promise<ReturnType<typeof drizzle>>
	>();

	async getOrgDb(organizationId: string) {
		if (this.orgConnections.has(organizationId)) {
			return this.orgConnections.get(organizationId)!;
		}

		if (this.pendingConnections.has(organizationId)) {
			return this.pendingConnections.get(organizationId)!;
		}

		const initPromise = this._initializeOrgDb(organizationId);
		this.pendingConnections.set(organizationId, initPromise);

		try {
			const orgDb = await initPromise;
			return orgDb;
		} finally {
			this.pendingConnections.delete(organizationId);
		}
	}

	private async _initializeOrgDb(organizationId: string) {
		const dbPath = path.join(
			appRoot,
			env.ORG_FOLDER_PATH,
			`${organizationId}.sqlite`,
		);
		const isNewDatabase = !fs.existsSync(dbPath);

		if (isNewDatabase) {
			fs.copyFileSync(path.join(appRoot, env.ORG_DATABASE_PATH), dbPath);
		}

		const client = new Database(dbPath);
		const orgDb = createDrizzleExtension(
			drizzle({ client, schema: orgSchema }),
		);

		if (!isNewDatabase) {
			const errorResponse = migrate(orgDb, {
				migrationsFolder: path.join(appRoot, "src/db/migrations-org"),
			});
			if (errorResponse) {
				console.error(errorResponse);
				throw new Error(
					`Error applying migration to ${organizationId}.sqlite`,
					{ cause: errorResponse },
				);
			}
		}

		this.orgConnections.set(organizationId, orgDb);

		return orgDb;
	}
}

export const dbManager = new DatabaseManager();

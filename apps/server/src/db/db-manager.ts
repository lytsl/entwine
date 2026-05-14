import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { appRoot } from "@/utils/app-root";
import { env } from "../../env";
import mainSchema from "./schema-main";
import mainRelations from "./schema-main/relations";
import orgSchema, { orgRelations } from "./schema-org";
import { createDrizzleExtension } from "./utils/sync-extension";
import { IssueStatusType } from "./schema-org/issue";
import { notInArray } from "drizzle-orm/singlestore-core/expressions";
import { inArray } from "drizzle-orm";
import { SyncActionEnum } from "./schema-org/metadata";

class DatabaseManager {
  private client: Database;
  db = drizzle({
    schema: mainSchema,
    relations: mainRelations,
  });

  private orgConnections = new Map<string, ReturnType<typeof drizzle>>();
  private pendingConnections = new Map<
    string,
    Promise<ReturnType<typeof drizzle>>
  >();

  constructor() {
    this.client = new Database(env.MAIN_DATABASE_PATH, {
      safeIntegers: undefined,
      strict: undefined,
    });
    this.client.run("PRAGMA journal_mode = WAL;");
    this.db = drizzle({
      client: this.client,
      schema: mainSchema,
      relations: mainRelations,
    });
  }

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
    const dbDirectory = path.join(dbPath, "..");
    if (!fs.existsSync(dbDirectory)) {
      fs.mkdirSync(dbDirectory, { recursive: true });
    }
    const isNewDatabase = !fs.existsSync(dbPath);

    if (isNewDatabase) {
      fs.copyFileSync(path.join(appRoot, env.ORG_DATABASE_PATH), dbPath);
    }

    const client = new Database(dbPath, {
      safeIntegers: undefined,
      strict: undefined,
    });
    client.run("PRAGMA journal_mode = WAL;");

    const orgDb = createDrizzleExtension(
      drizzle({ client, schema: orgSchema, relations: orgRelations }),
    );

    orgDb.transaction((tx) => {
      const existingIssueStatuses = tx
        .select()
        .from(orgSchema.IssueStatus)
        .where(
          inArray(orgSchema.IssueStatus.type, Object.values(IssueStatusType)),
        )
        .all();

      const newIssueStatuses = Object.values(IssueStatusType).filter(
        (name) => !existingIssueStatuses.find((i) => i.name === name),
      );
      if (newIssueStatuses.length > 0) {
        const issueStatuses = tx
          .insert(orgSchema.IssueStatus)
          .values(
            newIssueStatuses.map((type) => ({
              type,
              name: type,
              indefinite: true,
            })),
          )
          .returning()
          .all();

        tx.insert(orgSchema.Sync)
          .values(
            issueStatuses.map((p) => ({
              modelId: p.id,
              modelName: "IssueStatus",
              action: SyncActionEnum.Insert,
            })),
          )
          .run();
      }
    });

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

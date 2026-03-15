import { drizzle } from "drizzle-orm/better-sqlite3";
import * as mainSchema from "./schema/main";
import * as tenantSchema from "./schema/tenant";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { defineConfig } from "drizzle-kit";

class DatabaseManager {
  // Store the single main database connection
  private mainDbInstance: ReturnType<typeof drizzle> | null = null;

  // Cache for organization-specific connections
  private tenantConnections = new Map<string, ReturnType<typeof drizzle>>();

  /**
   * Getter for the main authentication & routing database.
   * Initializes the connection on the first call and returns the cached instance thereafter.
   */
  get main() {
    if (!this.mainDbInstance) {
      const dbPath = path.join(process.cwd(), "data", "main_auth.sqlite");
      const client = createClient({ url: `file:${dbPath}` });

      // WAL mode is highly recommended for SQLite concurrency
      // client.pragma("journal_mode = WAL");

      this.mainDbInstance = drizzle({ client, schema: mainSchema });
    }
    return this.mainDbInstance;
  }

  /**
   * Retrieves or initializes a database connection for a specific organization.
   */
  org(organizationId: string) {
    // Return cached connection if it exists
    if (this.tenantConnections.has(organizationId)) {
      return this.tenantConnections.get(organizationId)!;
    }

    // Enforce predictable naming: e.g., "org_abc123.sqlite"
    const dbFileName = `org_${organizationId}.sqlite`;
    const tenantsDir = path.join(process.cwd(), "data", "tenants");
    const dbPath = path.join(tenantsDir, dbFileName);

    const isNewDatabase = !fs.existsSync(dbPath);
    if (isNewDatabase) {
      fs.mkdirSync(tenantsDir, { recursive: true });
      const config = defineConfig({
        schema: "./src/db/schema",
        out: "./src/db/migrations",
        dialect: "turso",
        dbCredentials: {
          url: process.env.DATABASE_URL || "",
        },
      });
    }

    const client = createClient({ url: `file:${dbPath}` });
    // client.pragma("journal_mode = WAL");

    const tenantDb = drizzle({ client, schema: tenantSchema });

    // Cache the connection for future requests in the same lifecycle
    this.tenantConnections.set(organizationId, tenantDb);

    return tenantDb;
  }
}

// Export a single instance to be used throughout the app
export const db = new DatabaseManager();

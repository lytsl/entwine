/** Shared by the suites that start their own servers. */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { devices, type PlaywrightTestConfig } from "@playwright/test";

// Each run gets fresh databases, seeded with the demo workspace.
const dataDir = process.env.E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), "entwine-e2e-"));
process.env.E2E_DATA_DIR = dataDir;
export const production = process.env.AUDIT_MODE === "production";
const env = {
  NODE_ENV: production ? "production" : "development",
  AUTH_DB_PATH: join(dataDir, "auth.db"),
  TENANT_DB_DIR: join(dataDir, "tenants"),
  BETTER_AUTH_SECRET: "e2e-secret-with-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  // Every test signs in as the same few members, who together send more than one person does.
  SYNC_REQUESTS_PER_MINUTE: "100000",
  SMTP_URL: "smtp://127.0.0.1:3025",
};
// Playwright runs a command from its config's folder; the paths below are from the workspace's.
const cwd = join(import.meta.dirname, "..");

export const base = {
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: [
    // First: the seed's accounts are mailed as they sign up. `helpers/mail` reads what it kept.
    {
      command: "bun ../../apps/backend/test/helpers/smtp-sink.ts",
      url: "http://127.0.0.1:3026/messages",
      env: { SMTP_SINK_PORT: "3025", SMTP_SINK_HTTP_PORT: "3026" },
      cwd,
      reuseExistingServer: false,
    },
    {
      command: "bun ../../apps/backend/scripts/seed-demo.ts && bun ../../apps/backend/src/index.ts",
      url: "http://localhost:3001/api/health",
      env,
      cwd,
      reuseExistingServer: false,
    },
    {
      command: `bun run --cwd ../../apps/frontend ${production ? "start" : "dev"} -- --host 127.0.0.1 --strictPort`,
      url: "http://localhost:3000",
      cwd,
      reuseExistingServer: false,
    },
  ],
} satisfies PlaywrightTestConfig;

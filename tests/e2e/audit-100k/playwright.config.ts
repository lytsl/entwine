import { defineConfig } from "@playwright/test";

/**
 * Runs against servers started beforehand (see README.md): seeding takes minutes, and every spec reads the same
 * workspace.
 */
export default defineConfig({
  testDir: ".",
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  expect: { timeout: 20_000 },
  outputDir: process.env.AUDIT_RESULTS ?? "../audit-results/100k",
  reporter: [["list"]],
  use: {
    baseURL: process.env.AUDIT_ORIGIN ?? "http://localhost:4100",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    timezoneId: "Asia/Kolkata",
    actionTimeout: 30_000,
    trace: "off",
  },
});

import { defineConfig } from "@playwright/test";
import { base, production } from "../helpers/servers";

const results = `../audit-results/${production ? "production" : "development"}`;

/** One test at a time, so that nothing else runs as it measures. */
export default defineConfig({
  ...base,
  testDir: ".",
  workers: 1,
  retries: 0,
  use: { ...base.use, actionTimeout: 10_000 },
  timeout: 120_000,
  outputDir: results,
  reporter: [["list"], ["json", { outputFile: `${results}/results.json` }]],
});

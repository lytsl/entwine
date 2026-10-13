import { defineConfig } from "@playwright/test";

/** Against servers started beforehand, as the 100,000-issue audit runs (see ../audit-100k/README.md). */
export default defineConfig({
  testDir: ".",
  workers: 4,
  fullyParallel: true,
  retries: 0,
  expect: { timeout: 10_000 },
  // Not SWEEP_OUT itself: Playwright empties its output directory when a run starts.
  outputDir: `${process.env.SWEEP_OUT ?? "sweep-out"}/playwright`,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SWEEP_ORIGIN ?? "http://localhost:4100",
    headless: true,
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
    trace: "off",
  },
});

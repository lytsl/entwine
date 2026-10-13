import { defineConfig } from "@playwright/test";
import { base } from "../helpers/servers";

export default defineConfig({ ...base, testDir: "." });

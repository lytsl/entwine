/** `bun run restore <backup>`: replaces the data with a backup's, while no server runs. Without a name, lists them. */
import { readEnv } from "../src/env";
import { backupStore, backups, restore } from "../src/services/backup";

const env = readEnv();
const store = backupStore(env.backup);
const name = process.argv[2];
if (name) {
  await restore(env, store, name);
  console.log(`[restore] the data is now that of ${name}`);
} else {
  console.log(["Usage: bun run restore <backup>, one of:", ...(await backups(store))].join("\n  "));
  process.exit(1);
}

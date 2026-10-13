/**
 * `bun run backup`: a backup now, sent to the bucket, beside a running server or without one. The server runs it with
 * `--if-due`, which makes one only when the newest is a day old.
 */
import { readEnv } from "../src/env";
import { backup, backupDue, backupStore } from "../src/services/backup";

const env = readEnv();
const store = backupStore(env.backup);
if (!process.argv.includes("--if-due") || (await backupDue(store)))
  console.log(`[backup] made ${await backup(env, store)}`);

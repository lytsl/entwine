/**
 * Backups of everything the server keeps, in an S3-compatible bucket: `backups/<time>.tar.gz` is the data directory,
 * with the tenant directory as its `tenants/`, wherever that is. The copy is made in a temporary directory, packed
 * and sent as one object, so a backup is in the bucket whole or not at all. A backup may be made beside a running
 * server: it only reads, and needs no lock. A restore replaces the data, so it takes the server's.
 */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { S3Client, type S3Options } from "bun";
import { LOCK_FILE, lockData } from "./data-lock";

export interface DataPaths {
  authPath: string;
  tenantDir: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Older backups are deleted as new ones are made. */
const KEPT = 7;
/** The time a backup was begun, as a file name. */
const NAME = /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.\d{3}Z$/;
const PREFIX = "backups/";
const SUFFIX = ".tar.gz";
const ARCHIVE = "backup.tar.gz";
const TENANTS = "tenants";

const key = (name: string) => `${PREFIX}${name}${SUFFIX}`;

export function backupStore(options: S3Options): S3Client {
  if (!options.bucket) throw new Error("Set S3_BUCKET");
  return new S3Client(options);
}

/** What neither a backup nor a restore touches: the lock, and the tenant directory when it is inside the data's. */
const apart = ({ authPath, tenantDir }: DataPaths) =>
  [join(dirname(authPath), LOCK_FILE), tenantDir].map((path) => resolve(path));

/** `VACUUM INTO` writes one moment of a database that is being written, and leaves its WAL behind. */
function copyDatabase(from: string, to: string) {
  const db = new Database(from, { readonly: true });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    db.query("VACUUM INTO ?").run(to);
  } finally {
    db.close();
  }
}

async function copyTree(from: string, to: string, skip: string[]): Promise<void> {
  await mkdir(to, { recursive: true });
  const entries = (await readdir(from, { withFileTypes: true }).catch(() => [])).filter(
    (entry) => !skip.includes(resolve(from, entry.name)) && !/\.db-(wal|shm)$/.test(entry.name),
  );
  const isDatabase = (entry: { name: string }) => entry.name.endsWith(".db");
  // Databases first: an attachment's bytes are stored before its row and outlive it by a day, so the files copied
  // after a database hold every attachment its rows name.
  for (const entry of [...entries.filter(isDatabase), ...entries.filter((entry) => !isDatabase(entry))]) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    try {
      if (entry.isDirectory()) await copyTree(source, target, skip);
      else if (isDatabase(entry)) copyDatabase(source, target);
      else await copyFile(source, target);
    } catch (error) {
      // The server deletes workspaces and unattached files while a backup runs: what is gone by its turn is skipped.
      if (existsSync(source)) throw error;
    }
  }
}

/** Run in `tree` with relative names: GNU tar reads a drive letter's colon as a remote host. */
async function tar(tree: string, ...args: string[]) {
  const code = await Bun.spawn(["tar", ...args], { cwd: tree, stdio: ["ignore", "inherit", "inherit"] }).exited;
  if (code) throw new Error(`tar exited with ${code}`);
}

/** The bucket's backups, oldest first: their names are their times. */
export const backups = async (store: S3Client): Promise<string[]> =>
  ((await store.list({ prefix: PREFIX })).contents ?? [])
    .map((object) => object.key.slice(PREFIX.length, -SUFFIX.length))
    .filter((name) => NAME.test(name))
    .sort();

export async function backupDue(store: S3Client): Promise<boolean> {
  const newest = (await backups(store)).at(-1);
  return !newest || Date.now() - Date.parse(newest.replace(/-(\d\d)-(\d\d)\./, ":$1:$2.")) >= DAY_MS;
}

/** Resolves with the new backup's name. */
export async function backup(paths: DataPaths, store: S3Client): Promise<string> {
  const name = new Date().toISOString().replaceAll(":", "-");
  const work = await mkdtemp(join(tmpdir(), "entwine-backup-"));
  try {
    const tree = join(work, "tree");
    await copyTree(dirname(paths.authPath), tree, apart(paths));
    await copyTree(paths.tenantDir, join(tree, TENANTS), apart(paths));
    await tar(tree, "-czf", `../${ARCHIVE}`, ".");
    await store.write(key(name), Bun.file(join(work, ARCHIVE)));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  for (const old of (await backups(store)).slice(0, -KEPT)) await store.delete(key(old));
  return name;
}

/** Throws while a server holds the data directory. */
export async function restore(paths: DataPaths, store: S3Client, name: string): Promise<void> {
  if (!NAME.test(name) || !(await store.exists(key(name)))) throw new Error(`There is no backup ${name}`);
  const { authPath, tenantDir } = paths;
  const dataDir = dirname(authPath);
  const release = lockData(dataDir);
  const work = await mkdtemp(join(tmpdir(), "entwine-restore-"));
  try {
    const tree = join(work, "tree");
    await Bun.write(join(work, ARCHIVE), store.file(key(name)));
    await mkdir(tree);
    await tar(tree, "-xzf", `../${ARCHIVE}`);
    // Everything goes, the WAL files too: one left beside a restored database would be replayed into it.
    for (const dir of [tenantDir, dataDir])
      for (const entry of await readdir(dir).catch(() => []))
        if (!apart(paths).includes(resolve(dir, entry))) await rm(join(dir, entry), { recursive: true, force: true });
    await cp(tree, dataDir, { recursive: true, filter: (from) => resolve(from) !== resolve(tree, TENANTS) });
    await cp(join(tree, TENANTS), tenantDir, { recursive: true });
  } finally {
    await rm(work, { recursive: true, force: true });
    release();
  }
}

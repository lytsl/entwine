/**
 * Points the emitted contract's type imports at `@prisma/orm-sqlite`: the emitted file imports Prisma's internal
 * package names, which are not installed.
 */
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const run = async (command: string[]) => {
  const child = Bun.spawn(command, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) throw new Error(`${command.join(" ")} failed`);
};

await run([join(root, "node_modules/.bin/prisma"), "contract", "emit", "--config", "prisma.config.ts"]);
const types = join(root, "apps/backend/src/database/contract.d.ts");
const text = await Bun.file(types).text();
await Bun.write(
  types,
  text
    .replaceAll("@internal/adapter-sqlite/", "@prisma/orm-sqlite/adapter/")
    .replaceAll("@internal/sql-contract/", "@prisma/orm-sqlite/family-contract/")
    .replaceAll("@internal/contract/", "@prisma/orm-sqlite/contract/"),
);
await run([
  join(root, "node_modules/.bin/biome"),
  "check",
  "--write",
  types,
  join(root, "apps/backend/src/database/contract.json"),
]);

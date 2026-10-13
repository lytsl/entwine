import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareTenant } from "../../src/database/prepare";
import { removeTemp } from "../helpers/temp";

test("a tenant file is checked against the contract once, and again when its marker names another", async () => {
  const dir = mkdtempSync(join(tmpdir(), "entwine-prepare-"));
  const path = join(dir, "t1.db");
  const sql = (statement: string) => {
    const db = new Database(path);
    try {
      return db.query(statement).all() as Record<string, unknown>[];
    } finally {
      db.close();
    }
  };
  const tables = () => sql("SELECT name FROM sqlite_master WHERE type = 'table'").map((table) => table.name);
  try {
    await prepareTenant(path);
    expect(tables()).toContain("issue");
    const [marker] = sql("SELECT core_hash FROM _prisma_marker");

    // The marker says the file is at the contract: the file is not read again.
    sql("DROP TABLE comment");
    await prepareTenant(path);
    expect(tables()).not.toContain("comment");

    // A file last brought to another contract is updated to this one.
    sql("UPDATE _prisma_marker SET core_hash = 'another'");
    await prepareTenant(path);
    expect(tables()).toContain("comment");
    expect(sql("SELECT core_hash FROM _prisma_marker")).toEqual([marker]);
  } finally {
    removeTemp(dir);
  }
});

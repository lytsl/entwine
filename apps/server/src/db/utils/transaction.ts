import { sql } from "drizzle-orm";
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite";

let transactionQueue: Promise<void> | null = null;

export async function runDbTransaction<
  T,
  TSchema extends Record<string, unknown>,
>(db: SQLiteBunDatabase<TSchema>, callback: () => Promise<T>): Promise<T> {
  while (transactionQueue !== null) {
    await transactionQueue;
  }

  let releaseLock!: () => void;
  transactionQueue = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    db.run(sql.raw(`BEGIN`));

    try {
      const result = await callback();
      db.run(sql.raw(`COMMIT`));
      return result;
    } catch (error) {
      db.run(sql.raw(`ROLLBACK`));
      throw error;
    }
  } finally {
    releaseLock();
    transactionQueue = null;
  }
}

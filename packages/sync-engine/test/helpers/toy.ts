import { Database } from "bun:sqlite";
import type { Schema } from "../../src";

/** A schema the engine has never heard of: lists of notes, and memos that are one member's own. */
export type Toy = {
  List: { id: string; name: string };
  Note: { id: string; listId: string; body: string; done: number };
  Memo: { id: string; memberId: string; listId: string; text: string };
};
export const schema: Schema<Toy> = {
  version: "1",
  models: { List: { load: "instant" }, Note: { load: "explicit" }, Memo: { load: "instant", owner: "memberId" } },
};

/** The app's tables, plus the change log and epoch the engine keeps in the same file. */
export async function prepare(path: string): Promise<void> {
  const db = new Database(path, { create: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS list (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS note (id TEXT PRIMARY KEY, listId TEXT NOT NULL REFERENCES list(id), body TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS memo (id TEXT PRIMARY KEY, memberId TEXT NOT NULL, listId TEXT NOT NULL,
      text TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS change (id INTEGER PRIMARY KEY, model TEXT NOT NULL, rowId TEXT NOT NULL, data TEXT,
      before TEXT, txid TEXT, actorId TEXT, createdAt INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS change_txid ON change (txid);
    CREATE TABLE IF NOT EXISTS epoch (id TEXT PRIMARY KEY);
  `);
  db.close();
}

export const note = (id: string, listId = "l1", body = id): Toy["Note"] => ({ id, listId, body, done: 0 });
export const memo = (id: string, memberId: string, listId = "l1"): Toy["Memo"] => ({ id, memberId, listId, text: id });

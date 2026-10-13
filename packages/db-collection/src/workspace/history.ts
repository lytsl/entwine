/**
 * Undo and redo of the member's own edits, one transaction at a time: an undo is a new server-side revert, with an
 * optimistic inverse. Every workspace mutate is recorded; stream changes are not. Stacks belong to the tab and are
 * kept in session storage.
 */
import type { RowMap } from "@entwine/sync-engine/protocol";
import type { PendingMutation, Transaction } from "@tanstack/db";
import { SyncError } from "../errors";
import type { SessionStore, Step } from "../types/history";
import type { Collections, Writable } from "../types/workspace";

const LIMIT = 100;

export class History {
  private readonly undos: Step[] = [];
  private readonly redos: Step[] = [];

  /** `write` sends a transaction without recording it; it rejects with a `SyncError` when refused. */
  constructor(
    private readonly collections: Collections<RowMap>,
    private readonly write: (fn: () => void, revert: string) => { id: string; done: Promise<void> },
    private readonly session?: SessionStore,
    private readonly key = "entwine-history",
    private readonly keepOnClose: () => boolean = () => false,
  ) {
    try {
      const saved = JSON.parse(session?.getItem(key) ?? "null");
      if (Array.isArray(saved?.undos) && Array.isArray(saved?.redos)) {
        this.undos.push(...saved.undos.slice(-LIMIT));
        this.redos.push(...saved.redos.slice(-LIMIT));
      }
    } catch {}
  }

  clear(): void {
    this.undos.length = 0;
    this.redos.length = 0;
    this.session?.removeItem(this.key);
  }

  get canUndo(): boolean {
    return this.undos.length > 0;
  }

  get canRedo(): boolean {
    return this.redos.length > 0;
  }

  /** Clears what could be redone. */
  record(transaction: Pick<Transaction, "mutations" | "id">): Step {
    const step: Step = {
      id: transaction.id,
      operations: transaction.mutations.map((m: PendingMutation) => ({
        model: m.collection.id,
        key: String(m.key),
        type: m.type,
        original: m.original as Record<string, unknown>,
        modified: m.modified as Record<string, unknown>,
        changes: m.changes as Record<string, unknown>,
      })),
    };
    this.undos.push(step);
    if (this.undos.length > LIMIT) this.undos.shift();
    this.redos.length = 0;
    this.notify();
    return step;
  }

  /** Drops a step whose transaction the server refused. */
  forget(step: Step): void {
    for (const stack of [this.undos, this.redos]) {
      const index = stack.indexOf(step);
      if (index >= 0) stack.splice(index, 1);
    }
    this.notify();
  }

  /** Rejects with a `SyncError` if the step can no longer be applied or the server refuses it. */
  undo(): Promise<void> {
    return this.move(this.undos, this.redos, "undo");
  }

  redo(): Promise<void> {
    return this.move(this.redos, this.undos, "redo");
  }

  private async move(from: Step[], to: Step[], direction: "undo" | "redo"): Promise<void> {
    const step = from.pop();
    if (!step) return;
    this.notify();
    const apply = this.plan(step, direction);
    if (!apply)
      throw new SyncError(
        "conflict",
        `It has changed since, so it cannot be ${direction === "undo" ? "undone" : "redone"}`,
      );
    to.push(step);
    this.notify();
    try {
      const write = this.write(apply, step.id);
      step.id = write.id;
      this.notify();
      await write.done;
    } catch (error) {
      if (!this.keepOnClose()) this.forget(step);
      throw error;
    }
  }

  /**
   * Null when a row the writes need is gone or back. Nothing else is compared: the last write wins over a field
   * another member changed since.
   */
  private plan(step: Step, direction: "undo" | "redo"): (() => void) | null {
    const operations = direction === "undo" ? [...step.operations].reverse() : step.operations;
    const writes = operations.map((op) => {
      const type =
        direction === "redo" ? op.type : op.type === "insert" ? "delete" : op.type === "delete" ? "insert" : "update";
      const values =
        type === "insert"
          ? direction === "undo"
            ? op.original
            : op.modified
          : direction === "undo"
            ? Object.fromEntries(Object.keys(op.changes).map((field) => [field, op.original[field]]))
            : op.changes;
      return { collection: this.collections[op.model] as unknown as Writable, key: op.key, type, values };
    });
    const ok = writes.every(({ collection, key, type }) => collection.has(key) === (type !== "insert"));
    if (!ok) return null;
    return () => {
      for (const { collection, key, type, values } of writes) {
        if (type === "insert") collection.insert(values);
        else if (type === "delete") collection.delete(key);
        else collection.update(key, (draft) => Object.assign(draft, values));
      }
    };
  }

  private notify(): void {
    try {
      this.session?.setItem(this.key, JSON.stringify({ undos: this.undos, redos: this.redos }));
    } catch {}
  }
}

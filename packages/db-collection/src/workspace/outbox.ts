/**
 * A tab's writes on their way to the server. Writes are TanStack transactions: they show at once, reach the server
 * one at a time in the order they were made, and settle once the stream has brought their result back. Unconfirmed
 * transactions are kept in the device's store, and the workspace lock's holder sends those of tabs that closed
 * before the server answered.
 */
import type { RowMap, TransactionResponse } from "@entwine/sync-engine/protocol";
import { createTransaction, type Transaction } from "@tanstack/db";
import { closedError, failure } from "../errors";
import type { Entry } from "../types/store";
import type { Collections } from "../types/workspace";
import { applyMutations, toEntry } from "../utils/entries";
import { backoff, type Tab } from "./tab";

interface Pending {
  entry: Entry;
  resolve(): void;
  reject(error: Error): void;
}

export class Outbox {
  private readonly outbox: Pending[] = [];
  /** Tabs whose kept transactions this leader waits to send. */
  private readonly watched = new Set<string>();
  private draining = false;

  constructor(
    private readonly tab: Tab,
    private readonly collections: Collections<RowMap>,
  ) {}

  /** Transactions not yet answered by the server. */
  queued(): number {
    return this.outbox.length;
  }

  /** Starts a transaction; `revert` makes it an undo or redo of that transaction, with `fn` as its optimistic form. */
  begin(fn: () => void, revert?: string) {
    const transaction = createTransaction({
      mutationFn: ({ transaction }) => this.send(toEntry(transaction as Transaction, revert)),
    });
    transaction.mutate(fn);
    return { id: transaction.id, transaction, done: transaction.when("settled").then(() => {}) };
  }

  /** Queues a transaction, kept on the device until the server answers it. */
  async send(entry: Entry, keep = true): Promise<void> {
    const { tab } = this;
    if (tab.closed) throw closedError();
    if (keep && tab.local) {
      tab.persist((store) => store.add(entry, tab.id), true);
      // The waiting count must not promise durability before the device has kept the transaction.
      await tab.kept;
    }
    return new Promise((resolve, reject) => {
      if (tab.closed) return reject(closedError());
      this.outbox.push({ entry, resolve, reject });
      tab.notify();
      void this.drain();
    });
  }

  /**
   * Sends the outbox in order, one transaction at a time, so a write never overtakes one it builds on. Delivery in
   * doubt (no answer, or a server error) is retried with the same id, which the server applies once.
   */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    const { tab } = this;
    try {
      for (let attempt = 0; this.outbox.length && !tab.closed; ) {
        const pending = this.outbox[0];
        const response = await tab
          .fetch(`${tab.url}/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pending.entry.request),
          })
          .catch(() => undefined);
        if (tab.closed) return;
        // 429: the member's requests are limited for a while; the transaction is sent again like one that got lost.
        if (!response || response.status >= 500 || response.status === 429) {
          await tab.sleep(backoff(attempt++));
          continue;
        }
        attempt = 0;
        this.outbox.shift();
        tab.persist((store) => store.remove(pending.entry.request.id), true);
        tab.notify();
        if (!response.ok) pending.reject(await failure(response));
        else {
          const { cursor } = (await response.json()) as TransactionResponse;
          tab.awaitCursor(cursor).then(pending.resolve, pending.reject);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /**
   * Sends the transactions other tabs kept and could not send: at once for tabs that have closed, and for tabs still
   * open once they close.
   */
  async adoptOrphans(): Promise<void> {
    const { tab } = this;
    const local = tab.local;
    if (!local || tab.role !== "leader" || tab.closed) return;
    const adopt = async (owner: string) => {
      if (!tab.closed) for (const entry of await local.store.adopt(owner, tab.id)) this.replay(entry);
    };
    for (const owner of await local.store.owners()) {
      if (owner === tab.id || this.watched.has(owner)) continue;
      const lock = tab.lock(`tab:${owner}`);
      if (await local.locks.free(lock)) {
        await adopt(owner);
        continue;
      }
      this.watched.add(owner);
      let release = () => {};
      release = local.locks.hold(lock, () => {
        adopt(owner)
          .catch((error) => tab.report(error))
          .finally(() => {
            this.watched.delete(owner);
            // The lock was the other tab's; hold it no longer than it takes to adopt.
            queueMicrotask(release);
          });
      });
      tab.releases.push(() => release());
    }
  }

  /** Shows an adopted transaction again and sends it; nobody waits for it, so a refusal is reported. */
  private replay(entry: Entry): void {
    const transaction = createTransaction({ mutationFn: () => this.send(entry, false) });
    transaction.mutate(() => applyMutations(this.collections, entry.mutations));
    const done = transaction.mutations.length ? transaction.when("settled") : this.send(entry, false);
    done.catch((error) => this.tab.report(error));
  }

  /** Rejects the writes the server has not answered; they stay on the device, for the next tab to send. */
  close(): void {
    for (const pending of this.outbox.splice(0)) pending.reject(closedError());
  }
}

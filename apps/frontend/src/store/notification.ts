import type { Notification } from "../types/rows";
import { RowStore } from "./row-store";

/** The member's own notifications: the server sends nobody else's, and keeps them few. */
export class Notifications extends RowStore<Notification> {
  /** Newest first. */
  get sorted(): Notification[] {
    return this.derived("sorted", (rows) => rows.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)));
  }

  get unread(): number {
    return this.derived("unread", (rows) => rows.filter((n) => n.readAt === null).length);
  }

  /** The time is the server's; any number says "read". */
  setRead = (id: string, read: boolean) => {
    const current = this.get(id);
    if (!current || (current.readAt !== null) === read) return;
    return this.ws.mutate(() =>
      this.ws.collections.Notification.update(id, (notification) => {
        notification.readAt = read ? Date.now() : null;
      }),
    );
  };

  readAll = () => this.#read(() => true);

  /** Opening an issue from the inbox shows what every notification of it is about, so all of them are read. */
  readIssue = (issueId: string) => this.#read((n) => n.issueId === issueId);

  /** One change, so one undo. */
  #read(which: (notification: Notification) => boolean) {
    const unread = this.sorted.filter((n) => n.readAt === null && which(n));
    if (!unread.length) return;
    const now = Date.now();
    return this.ws.mutate(() => {
      for (const { id } of unread)
        this.ws.collections.Notification.update(id, (notification) => {
          notification.readAt = now;
        });
    });
  }
}

import { isAdmin } from "@entwine/shared";
import type { MentionPerson } from "@entwine/ui/components/editor/mention";
import { type Member } from "../types/rows";
import { RowStore } from "./row-store";

export class Members extends RowStore<Member> {
  /** Members who can be assigned, by name. */
  get active(): Member[] {
    return this.derived("active", (members) =>
      members.filter((m) => !m.removed).sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  /** Whom a text can mention: a member who left keeps their name, and is not offered. */
  get people(): MentionPerson[] {
    return this.derived("people", (members) =>
      members
        .map(({ id, name, removed }) => ({ id, name, suggested: !removed }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  /** An owner or an admin. */
  isAdmin = (): boolean => isAdmin(this.get(this.ws.userId)?.role);

  /**
   * What a row keeps for its creator, an owner or an admin: deleting an issue, cycle or module, editing a view. A
   * scheduled cycle has no creator.
   */
  canManage = (row: { creatorId: string | null }): boolean => row.creatorId === this.ws.userId || this.isAdmin();
}

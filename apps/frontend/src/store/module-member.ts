import { pairId } from "@entwine/shared";
import { type ModuleMember } from "../types/rows";
import { RowStore } from "./row-store";

export class ModuleMembers extends RowStore<ModuleMember> {
  /** The ids of a module's members, those who left the workspace included. A module's array is the same one at every call. */
  of = (moduleId: string): string[] =>
    this.derived("of", (rows) => {
      const members = new Map<string, string[]>();
      for (const row of rows) members.set(row.moduleId, [...(members.get(row.moduleId) ?? []), row.memberId]);
      return members;
    }).get(moduleId) ?? NONE;

  toggle = (moduleId: string, memberId: string) => {
    const id = pairId(moduleId, memberId);
    const { ModuleMember } = this.ws.collections;
    return this.ws.mutate(() => {
      if (ModuleMember.has(id)) ModuleMember.delete(id);
      else ModuleMember.insert({ id, moduleId, memberId });
    });
  };
}

const NONE: string[] = [];

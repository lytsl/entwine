import { PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { UsersIcon } from "lucide-react";
import { memberOptions } from "../../../../lib/issue-options";
import { moduleMembers } from "../../../../lib/plan";
import type { Store } from "../../../../store";
import type { Module } from "../../../../types/rows";
import { MemberStack } from "./member-stack";

/** Members who left the workspace stay among the choices of the module they are on, so they can be taken off. */
export function ModuleMembersSelect({ module, store, disabled }: { module: Module; store: Store; disabled?: boolean }) {
  const members = moduleMembers(store, module.id);
  const names = members.map((member) => member.name).join(", ");
  return (
    <PropertySelect<string>
      label={members.length ? `Members: ${names}` : "Members"}
      tooltip={members.length > 1 ? names : undefined}
      disabled={disabled}
      multiple
      className="border-transparent"
      searchPlaceholder="Add or remove members…"
      emptyText="No members"
      options={() => memberOptions([...store.members.active, ...members.filter((member) => member.removed)])}
      isSelected={(id) => members.some((member) => member.id === id)}
      onSelect={(memberId) => store.moduleMembers.toggle(module.id, memberId)}
    >
      {members.length ? (
        <>
          <MemberStack members={members} />
          <span className="truncate text-foreground">
            {members.length === 1 ? members[0].name : `${members.length} members`}
          </span>
        </>
      ) : (
        <>
          <UsersIcon />
          <PropertyPlaceholder>No members</PropertyPlaceholder>
        </>
      )}
    </PropertySelect>
  );
}

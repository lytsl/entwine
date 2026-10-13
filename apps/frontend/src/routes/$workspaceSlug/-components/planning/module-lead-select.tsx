import { PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { memberOptions } from "../../../../lib/issue-options";
import type { Store } from "../../../../store";
import type { Module } from "../../../../types/rows";

/** A lead who left the workspace is still named, and no longer among the choices. */
export function ModuleLeadSelect({ module, store, disabled }: { module: Module; store: Store; disabled?: boolean }) {
  const lead = module.leadId ? store.members.get(module.leadId) : undefined;
  return (
    <PropertySelect<string | null>
      label={`Lead: ${lead?.name ?? "No lead"}`}
      disabled={disabled}
      className="border-transparent"
      searchPlaceholder="Set lead…"
      options={() => [
        { value: null, label: "No lead", icon: <UserAvatar user={null} size={16} /> },
        ...memberOptions(store.members.active),
      ]}
      isSelected={(id) => id === module.leadId}
      onSelect={(leadId) => leadId !== module.leadId && store.modules.update(module.id, { leadId })}
    >
      <UserAvatar user={lead} size={18} />
      {lead ? (
        <span className="truncate text-foreground">{lead.name}</span>
      ) : (
        <PropertyPlaceholder>No lead</PropertyPlaceholder>
      )}
    </PropertySelect>
  );
}

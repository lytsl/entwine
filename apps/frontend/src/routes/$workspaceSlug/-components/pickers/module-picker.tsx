import { type PropertyFace, PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { BoxIcon, PlusIcon } from "lucide-react";
import { moduleOptions, plansFrozen } from "../../../../lib/issue-options";
import type { Store } from "../../../../store";

export function ModulePicker({
  store,
  projectId,
  selected,
  onToggle,
  face = "pill",
}: {
  store: Store;
  projectId: string;
  selected: readonly string[];
  onToggle(moduleId: string): void;
  face?: PropertyFace;
}) {
  const only = selected.length === 1 ? store.modules.get(selected[0]) : undefined;
  const names = selected.map((id) => store.modules.get(id)?.name).filter(Boolean);
  return (
    <PropertySelect<string>
      label={selected.length ? `Modules: ${names.join(", ")}` : "Modules"}
      tooltip={face === "pill" || selected.length > 1 ? names.join(", ") || undefined : undefined}
      face={face}
      multiple
      disabled={plansFrozen(store, projectId)}
      searchPlaceholder="Add to modules…"
      emptyText="No modules"
      options={() => moduleOptions(store, projectId)}
      isSelected={(id) => selected.includes(id)}
      onSelect={onToggle}
    >
      {face === "icon" ? (
        <PlusIcon />
      ) : (
        <>
          <BoxIcon className="text-muted-foreground" />
          {selected.length === 0 ? (
            face === "pill" ? (
              "Modules"
            ) : (
              <PropertyPlaceholder>No modules</PropertyPlaceholder>
            )
          ) : (
            <span className="truncate">{only ? only.name : `${selected.length} modules`}</span>
          )}
        </>
      )}
    </PropertySelect>
  );
}

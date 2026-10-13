import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { type PropertyFace, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { stateOptions } from "../../../../lib/issue-options";
import type { Store } from "../../../../store";

export function StatePicker({
  store,
  projectId,
  value,
  onChange,
  face = "pill",
  showName = true,
}: {
  store: Store;
  projectId: string;
  value: string;
  onChange(stateId: string): void;
  face?: PropertyFace;
  showName?: boolean;
}) {
  const state = store.states.get(value);
  return (
    <PropertySelect<string>
      label={`State: ${state?.name ?? "unknown"}`}
      tooltip={face === "icon" || !showName ? `State: ${state?.name ?? "unknown"}` : undefined}
      face={face}
      searchPlaceholder="Change state…"
      options={() => stateOptions(store, projectId)}
      isSelected={(id) => id === value}
      onSelect={(id) => id !== value && onChange(id)}
    >
      {state && <StateIcon type={state.group} color={state.color} className="size-3.5!" />}
      {showName && face !== "icon" && <span className="truncate">{state?.name}</span>}
    </PropertySelect>
  );
}

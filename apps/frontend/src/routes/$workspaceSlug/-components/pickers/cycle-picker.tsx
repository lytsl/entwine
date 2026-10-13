import { type PropertyFace, PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { CycleIcon } from "../../../../components/cycle-icon";
import { useToday } from "../../../../hooks/use-today";
import { cycleOptions, plansFrozen } from "../../../../lib/issue-options";
import { cyclePhase } from "../../../../lib/plan";
import type { Store } from "../../../../store";

export function CyclePicker({
  store,
  projectId,
  value,
  onChange,
  face = "pill",
}: {
  store: Store;
  projectId: string;
  value: string | null;
  onChange(cycleId: string | null): void;
  face?: PropertyFace;
}) {
  const today = useToday();
  const cycle = value ? store.cycles.get(value) : undefined;
  const name = cycle?.name ?? "No cycle";
  return (
    <PropertySelect<string | null>
      label={`Cycle: ${name}`}
      tooltip={face === "pill" ? `Cycle: ${name}` : undefined}
      face={face}
      disabled={plansFrozen(store, projectId)}
      searchPlaceholder="Move to cycle…"
      emptyText="No cycles"
      options={() => cycleOptions(store, projectId, today)}
      isSelected={(id) => id === value}
      onSelect={(id) => id !== value && onChange(id)}
    >
      <CycleIcon phase={cycle && cyclePhase(cycle, today)} className="size-3.5" />
      {cycle ? (
        <span className="truncate">{cycle.name}</span>
      ) : face === "pill" ? (
        "Cycle"
      ) : (
        <PropertyPlaceholder>No cycle</PropertyPlaceholder>
      )}
    </PropertySelect>
  );
}

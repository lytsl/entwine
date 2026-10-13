import { CYCLE_PHASES } from "@entwine/shared";
import { useState } from "react";
import { CycleIcon } from "../../../../../../components/cycle-icon";
import { PHASE_LABELS } from "../../../../../../constants/cycle";
import { useStore } from "../../../../../../hooks/use-store";
import { useToday } from "../../../../../../hooks/use-today";
import { cyclesByPhase, planMatches } from "../../../../../../lib/plan";
import { CycleRow } from "./cycle-row";
import { PlansFrame } from "./plans-frame";
import { PlansSection } from "./plans-section";

export function CyclesList({ projectId }: { projectId: string }) {
  const store = useStore();
  const today = useToday();
  const [search, setSearch] = useState("");
  const all = store.cycles.of(projectId);
  const text = search.trim().toLowerCase();
  const phases = cyclesByPhase(
    all.filter((c) => planMatches(text, c)),
    today,
  );
  return (
    <PlansFrame kind="cycle" projectId={projectId} count={all.length} search={search} onSearch={setSearch}>
      {CYCLE_PHASES.map((phase) =>
        phases[phase].length ? (
          <PlansSection
            key={phase}
            title={PHASE_LABELS[phase].label}
            icon={<CycleIcon phase={phase} className="size-3.5" />}
            count={phases[phase].length}
            defaultOpen={phase !== "past"}
          >
            <div role="list">
              {phases[phase].map((cycle) => (
                <CycleRow key={cycle.id} cycle={cycle} phase={phase} store={store} />
              ))}
            </div>
          </PlansSection>
        ) : null,
      )}
      {text && CYCLE_PHASES.every((phase) => !phases[phase].length) && (
        <p className="p-8 text-center text-body text-muted-foreground">No cycles match “{search.trim()}”.</p>
      )}
    </PlansFrame>
  );
}

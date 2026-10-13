import { MODULE_STATUSES } from "@entwine/shared";
import { useState } from "react";
import { ModuleStatusIcon } from "../../../../../../components/module-status-icon";
import { MODULE_STATUS_LABELS } from "../../../../../../constants/module";
import { useStore } from "../../../../../../hooks/use-store";
import { moduleMatches } from "../../../../../../lib/plan";
import { ModuleCard } from "./module-card";
import { PlansFrame } from "./plans-frame";
import { PlansSection } from "./plans-section";

export function ModulesList({ projectId }: { projectId: string }) {
  const store = useStore();
  const [search, setSearch] = useState("");
  const all = store.modules.of(projectId);
  const text = search.trim().toLowerCase();
  const shown = all.filter((m) => moduleMatches(store, text, m));
  return (
    <PlansFrame kind="module" projectId={projectId} count={all.length} search={search} onSearch={setSearch}>
      {MODULE_STATUSES.map((status) => {
        const modules = shown.filter((m) => m.status === status);
        if (!modules.length) return null;
        return (
          <PlansSection
            key={status}
            title={MODULE_STATUS_LABELS[status].label}
            icon={<ModuleStatusIcon status={status} className="size-3.5" />}
            count={modules.length}
            defaultOpen={status !== "completed" && status !== "cancelled"}
          >
            <ul
              className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4 p-4"
              aria-label={`${MODULE_STATUS_LABELS[status].label} modules`}
            >
              {modules.map((module) => (
                <ModuleCard key={module.id} module={module} store={store} />
              ))}
            </ul>
          </PlansSection>
        );
      })}
      {text && !shown.length && (
        <p className="p-8 text-center text-body text-muted-foreground">No modules match “{search.trim()}”.</p>
      )}
    </PlansFrame>
  );
}

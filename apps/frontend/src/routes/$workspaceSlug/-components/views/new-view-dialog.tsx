import { DEFAULT_QUERY } from "@entwine/shared";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { Field, FieldLabel } from "@entwine/ui/components/ui/field";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";
import { LayersIcon } from "lucide-react";
import { useState } from "react";
import { useOpenView } from "../../../../hooks/use-open-view";
import { useStore } from "../../../../hooks/use-store";
import { ViewNameDialog } from "./view-name-dialog";

/** The new view opens with every issue, ready to be filtered. */
export function NewViewDialog({ onClose }: { onClose(): void }) {
  const store = useStore();
  const openView = useOpenView();
  const [projectId, setProjectId] = useState<string | null>(null);
  const project = projectId ? store.projects.get(projectId) : undefined;
  return (
    <ViewNameDialog
      title="New view"
      description="A view keeps filters and a display that everyone in the workspace can open."
      submitLabel="Create view"
      onClose={onClose}
      onSubmit={(name) => openView(store.views.create({ name, projectId, query: DEFAULT_QUERY }))}
    >
      <Field>
        <FieldLabel>Issues from</FieldLabel>
        <PropertySelect<string | null>
          label={`Issues from: ${project?.name ?? "All issues"}`}
          face="field"
          className="h-9 border"
          searchPlaceholder="Choose a project…"
          options={[
            { value: null, label: "All issues", icon: <LayersIcon className="size-4" /> },
            ...store.projects.active.map((p) => ({
              value: p.id,
              label: p.name,
              icon: <ProjectIcon project={p} size={16} />,
              keywords: [p.identifier],
            })),
          ]}
          isSelected={(id) => id === projectId}
          onSelect={setProjectId}
        >
          {project ? <ProjectIcon project={project} size={16} /> : <LayersIcon />}
          {project?.name ?? "All issues"}
        </PropertySelect>
      </Field>
    </ViewNameDialog>
  );
}

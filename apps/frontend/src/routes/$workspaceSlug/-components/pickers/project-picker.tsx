import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { type PropertyFace, PropertySelect } from "@entwine/ui/components/ui/property-select";
import type { Store } from "../../../../store";

export function ProjectPicker({
  store,
  value,
  onChange,
  face = "pill",
}: {
  store: Store;
  value: string;
  onChange(projectId: string): void;
  face?: PropertyFace;
}) {
  const project = store.projects.get(value);
  return (
    <PropertySelect<string>
      label={`Project: ${project?.name ?? "none"}`}
      face={face}
      searchPlaceholder="Move to project…"
      options={() =>
        store.projects.active.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <ProjectIcon project={p} size={16} />,
          hint: p.identifier,
          keywords: [p.identifier],
        }))
      }
      isSelected={(id) => id === value}
      onSelect={onChange}
    >
      {project && <ProjectIcon project={project} size={16} />}
      <span className="truncate">{project?.name ?? "Choose a project"}</span>
    </PropertySelect>
  );
}

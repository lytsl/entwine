import { Button } from "@entwine/ui/components/ui/button";
import { ArchiveIcon } from "lucide-react";
import { useStore } from "../../../../hooks/use-store";
import { type Project } from "../../../../types/rows";

export function ProjectArchivedBanner({ project }: { project: Project | undefined }) {
  const store = useStore();
  if (!project || project.archivedAt === null) return null;
  return (
    <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm" role="status">
      <ArchiveIcon className="size-4 text-muted-foreground" />
      {project.name} is archived. It accepts no new issues, and its cycles and modules are read-only.
      <Button
        className="ml-auto"
        variant="outline"
        size="sm"
        onClick={() => store.projects.setArchived(project.id, false)}
      >
        Restore
      </Button>
    </div>
  );
}

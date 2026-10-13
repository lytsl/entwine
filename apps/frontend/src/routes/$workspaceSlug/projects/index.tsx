import { Button } from "@entwine/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@entwine/ui/components/ui/empty";
import { SearchField } from "@entwine/ui/components/ui/search-field";
import { createFileRoute } from "@tanstack/react-router";
import { ArchiveIcon, FolderKanbanIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useProjectProgress } from "../../../hooks/use-project-progress";
import { useShell } from "../../../hooks/use-shell";
import { useStore } from "../../../hooks/use-store";
import { type Project } from "../../../types/rows";
import { ProjectCard } from "./-components/project-card";

export const Route = createFileRoute("/$workspaceSlug/projects/")({ component: ProjectsPage });

function ProjectsPage() {
  const store = useStore();
  const shell = useShell();
  const progress = useProjectProgress(store);
  const [search, setSearch] = useState("");
  const text = search.trim().toLowerCase();
  const matches = (p: Project) => !text || `${p.name} ${p.identifier}`.toLowerCase().includes(text);
  const active = store.projects.active.filter(matches);
  const archived = store.projects.sorted.filter((p) => p.archivedAt !== null && matches(p));

  return (
    <>
      <PageHeader title="Projects" icon={<FolderKanbanIcon />} count={store.projects.active.length}>
        <SearchField
          aria-label="Search projects"
          placeholder="Search projects…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button size="sm" className="h-7 text-body" onClick={() => shell.openCreate("project")}>
          <PlusIcon />
          New project
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-10 p-6">
          {store.projects.active.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderKanbanIcon />
                </EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>A project holds a team's issues and the states they move through.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => shell.openCreate("project")}>
                  <PlusIcon />
                  New project
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4" aria-label="Projects">
              {active.map((project) => (
                <ProjectCard key={project.id} project={project} stats={progress(project.id)} />
              ))}
            </ul>
          )}
          {archived.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-body font-medium text-muted-foreground">
                <ArchiveIcon className="size-4" />
                Archived
              </h2>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4" aria-label="Archived projects">
                {archived.map((project) => (
                  <ProjectCard key={project.id} project={project} stats={progress(project.id)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

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
import { BoxIcon, IterationCcwIcon, PlusIcon } from "lucide-react";
import { type ReactNode } from "react";
import { PageHeader } from "../../../../../../components/page-header";
import { ProjectCrumb } from "../../../../../../components/project-crumb";
import { useShell } from "../../../../../../hooks/use-shell";
import { useStore } from "../../../../../../hooks/use-store";
import { type PlanKind } from "../../../../../../types/rows";
import { ProjectArchivedBanner } from "../../../../-components/project/project-archived-banner";

export function PlansFrame({
  kind,
  projectId,
  count,
  search,
  onSearch,
  children,
}: {
  kind: PlanKind;
  projectId: string;
  count: number;
  search: string;
  onSearch(text: string): void;
  children: ReactNode;
}) {
  const store = useStore();
  const shell = useShell();
  const project = store.projects.get(projectId);
  if (!project) return <PageHeader title="Project not found" />;
  const frozen = project.archivedAt !== null;
  const noun = kind === "cycle" ? "cycle" : "module";
  const Icon = kind === "cycle" ? IterationCcwIcon : BoxIcon;
  return (
    <>
      <PageHeader
        title={kind === "cycle" ? "Cycles" : "Modules"}
        icon={<Icon />}
        crumbs={[<ProjectCrumb key="project" project={project} to={`${noun}s`} />]}
        count={count}
      >
        <SearchField
          aria-label={`Search ${noun}s`}
          placeholder={`Search ${noun}s…`}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <Button size="sm" className="h-7 text-body" disabled={frozen} onClick={() => shell.openCreate(kind, projectId)}>
          <PlusIcon />
          New {noun}
        </Button>
      </PageHeader>
      <ProjectArchivedBanner project={project} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {count === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon />
              </EmptyMedia>
              <EmptyTitle>No {noun}s yet</EmptyTitle>
              <EmptyDescription>
                {kind === "cycle"
                  ? "A cycle plans a stretch of days: pick the issues for it and follow them to done."
                  : "A module gathers the issues of one deliverable, however long it takes, and tracks its progress."}
              </EmptyDescription>
            </EmptyHeader>
            {!frozen && (
              <EmptyContent>
                <Button size="sm" onClick={() => shell.openCreate(kind, projectId)}>
                  <PlusIcon />
                  New {noun}
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          children
        )}
      </div>
    </>
  );
}

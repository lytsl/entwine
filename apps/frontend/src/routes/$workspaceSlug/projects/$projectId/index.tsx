import { DEFAULT_QUERY } from "@entwine/shared";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { LayersIcon } from "lucide-react";
import { PageHeader } from "../../../../components/page-header";
import { ProjectCrumb } from "../../../../components/project-crumb";
import { useStore } from "../../../../hooks/use-store";
import { useViewUrl } from "../../../../hooks/use-view-url";
import { activeFilterCount } from "../../../../lib/issue-filters";
import { querySearch } from "../../../../lib/url";
import { IssuesView } from "../../-components/issue-views/issues-view";
import { ProjectArchivedBanner } from "../../-components/project/project-archived-banner";
import { SaveViewButton } from "../../-components/views/save-view-button";
import { IssueScope } from "../../-components/workspace/issue-scope";

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/")({
  validateSearch: querySearch(),
  search: { middlewares: [stripSearchParams(DEFAULT_QUERY)] },
  component: ScopedPage,
});

function ProjectIssues() {
  const { projectId } = Route.useParams();
  const { peek, ...query } = Route.useSearch();
  const url = useViewUrl();
  const store = useStore();
  const inScope = store.issues.scope({ projectId });
  const project = store.projects.get(projectId);
  if (!project) return <PageHeader title="Project not found" />;
  return (
    <IssuesView
      title="Issues"
      icon={<LayersIcon />}
      crumbs={[<ProjectCrumb key="project" project={project} />]}
      banner={<ProjectArchivedBanner project={project} />}
      inScope={inScope}
      query={query}
      projectId={projectId}
      peek={peek}
      viewActions={activeFilterCount(query) > 0 && <SaveViewButton query={query} projectId={projectId} />}
      {...url}
    />
  );
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <ProjectIssues />
    </IssueScope>
  );
}

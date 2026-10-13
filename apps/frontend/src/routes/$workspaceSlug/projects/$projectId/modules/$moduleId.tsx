import { DEFAULT_QUERY } from "@entwine/shared";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { querySearch } from "../../../../../lib/url";
import { IssueScope } from "../../../-components/workspace/issue-scope";
import { PlanIssuesPage } from "../-components/plans/plan-issues-page";

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/modules/$moduleId")({
  validateSearch: querySearch(),
  search: { middlewares: [stripSearchParams(DEFAULT_QUERY)] },
  component: ScopedPage,
});

function ModulePage() {
  const { projectId, moduleId } = Route.useParams();
  return <PlanIssuesPage kind="module" projectId={projectId} planId={moduleId} search={Route.useSearch()} />;
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <ModulePage />
    </IssueScope>
  );
}

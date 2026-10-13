import { DEFAULT_QUERY } from "@entwine/shared";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { querySearch } from "../../../../../lib/url";
import { IssueScope } from "../../../-components/workspace/issue-scope";
import { PlanIssuesPage } from "../-components/plans/plan-issues-page";

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/cycles/$cycleId")({
  validateSearch: querySearch(),
  search: { middlewares: [stripSearchParams(DEFAULT_QUERY)] },
  component: ScopedPage,
});

function CyclePage() {
  const { projectId, cycleId } = Route.useParams();
  return <PlanIssuesPage kind="cycle" projectId={projectId} planId={cycleId} search={Route.useSearch()} />;
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <CyclePage />
    </IssueScope>
  );
}

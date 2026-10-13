import { createFileRoute } from "@tanstack/react-router";
import { IssueScope } from "../../../-components/workspace/issue-scope";
import { CyclesList } from "../-components/plans/cycles-list";

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/cycles/")({ component: ScopedPage });

function CyclesPage() {
  const { projectId } = Route.useParams();
  return <CyclesList key={projectId} projectId={projectId} />;
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <CyclesPage />
    </IssueScope>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { IssueScope } from "../../../-components/workspace/issue-scope";
import { ModulesList } from "../-components/plans/modules-list";

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/modules/")({ component: ScopedPage });

function ModulesPage() {
  const { projectId } = Route.useParams();
  return <ModulesList key={projectId} projectId={projectId} />;
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <ModulesPage />
    </IssueScope>
  );
}

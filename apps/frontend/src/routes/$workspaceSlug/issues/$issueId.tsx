import { eq, useLiveQuery, useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LinkIcon } from "lucide-react";
import { PageHeader } from "../../../components/page-header";
import { ProjectCrumb } from "../../../components/project-crumb";
import { useIssueInContext } from "../../../hooks/use-issue-in-context";
import { useStore } from "../../../hooks/use-store";
import { copyIssueLink } from "../../../lib/issue-actions";
import { IssueDetail } from "../-components/issue/issue-detail";
import { IssueQuickActions } from "../-components/issue-views/issue-menu/issue-quick-actions";
import { IssueScope } from "../-components/workspace/issue-scope";

export const Route = createFileRoute("/$workspaceSlug/issues/$issueId")({ component: ScopedPage });

function IssuePage() {
  const { issueId, workspaceSlug } = Route.useParams();
  const ws = useWorkspace();
  const store = useStore();
  const navigate = Route.useNavigate();
  const { data } = useLiveQuery({
    query: (q) => q.from({ issue: ws.collections.Issue }).where(({ issue }) => eq(issue.id, issueId)),
  });
  const issue = data?.[0];
  useIssueInContext("page", issue?.id);
  if (!issue) {
    return (
      <>
        <PageHeader title="Issue" />
        <div className="p-8 text-body text-muted-foreground">
          This issue does not exist, or it was deleted.{" "}
          <Link to="/$workspaceSlug" params={{ workspaceSlug }} className="underline underline-offset-4">
            Back to my issues
          </Link>
        </div>
      </>
    );
  }
  const project = store.projects.get(issue.projectId);
  return (
    <>
      <PageHeader
        title={store.issues.key(issue)}
        crumbs={project ? [<ProjectCrumb key="project" project={project} />] : []}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy link"
          title="Copy link"
          onClick={() => copyIssueLink(workspaceSlug, issue.id)}
        >
          <LinkIcon />
        </Button>
        <IssueQuickActions
          issue={issue}
          store={store}
          className="size-8"
          onDeleted={() =>
            navigate({
              to: "/$workspaceSlug/projects/$projectId",
              params: { workspaceSlug, projectId: issue.projectId },
            })
          }
        />
      </PageHeader>
      <IssueDetail issue={issue} store={store} layout="page" />
    </>
  );
}

function ScopedPage() {
  return (
    <IssueScope scope={{ issueId: Route.useParams().issueId }}>
      <IssuePage />
    </IssueScope>
  );
}

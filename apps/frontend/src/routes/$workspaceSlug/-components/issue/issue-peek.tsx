/**
 * Escape closes the peek through the view's shortcut. The peek shares the page's width only where both halves stay
 * readable; a narrower page gives it all of it.
 */
import { eq, useLiveQuery, useWorkspace } from "@entwine/db-collection/react";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { Button, buttonVariants } from "@entwine/ui/components/ui/button";
import { WithTooltip } from "@entwine/ui/components/ui/property-select";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronsRightIcon, LinkIcon, Maximize2Icon } from "lucide-react";
import { useIssueInContext } from "../../../../hooks/use-issue-in-context";
import { copyIssueLink } from "../../../../lib/issue-actions";
import { keyHint } from "../../../../lib/shortcuts";
import type { Store } from "../../../../store";
import { IssueQuickActions } from "../issue-views/issue-menu/issue-quick-actions";
import { IssueScope } from "../workspace/issue-scope";
import { IssueDetail } from "./issue-detail";

const workspaceRoute = getRouteApi("/$workspaceSlug");

export function IssuePeek({ issueId, store, onClose }: { issueId: string; store: Store; onClose(): void }) {
  const ws = useWorkspace();
  const { workspaceSlug } = workspaceRoute.useParams();
  const { data } = useLiveQuery({
    query: (q) => q.from({ issue: ws.collections.Issue }).where(({ issue }) => eq(issue.id, issueId)),
  });
  const issue = data?.[0];
  useIssueInContext("peek", issue?.id);

  const project = issue ? store.projects.get(issue.projectId) : undefined;
  return (
    <aside
      aria-label="Issue preview"
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l bg-background shadow-2xl shadow-black/10 dark:shadow-black/40 duration-200 animate-in slide-in-from-right-8 fade-in-0 @min-[56rem]/main:w-[min(46rem,58%)]"
    >
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-3">
        <WithTooltip
          tooltip={`Close (${keyHint("dismiss")})`}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}>
              <ChevronsRightIcon />
            </Button>
          }
        />
        {issue && (
          <WithTooltip
            tooltip="Open issue page"
            trigger={
              <Link
                from="/$workspaceSlug"
                to="/$workspaceSlug/issues/$issueId"
                params={{ issueId: issue.id }}
                aria-label="Open issue page"
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <Maximize2Icon />
              </Link>
            }
          />
        )}
        {issue && project && (
          <span className="ml-2 flex items-center gap-1.5 text-body text-muted-foreground">
            <ProjectIcon project={project} size={16} />
            {store.issues.key(issue)}
          </span>
        )}
        {issue && (
          <span className="ml-auto flex items-center gap-1">
            <WithTooltip
              tooltip="Copy link"
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy link"
                  onClick={() => copyIssueLink(workspaceSlug, issue.id)}
                >
                  <LinkIcon />
                </Button>
              }
            />
            <IssueQuickActions issue={issue} store={store} onDeleted={onClose} className="size-8" />
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {issue ? (
          // A page that holds issues of several projects may not hold the rest of this one's project, which its
          // sub-issues and pickers show.
          <IssueScope scope={{ issueId: issue.id }}>
            <IssueDetail issue={issue} store={store} layout="peek" />
          </IssueScope>
        ) : (
          <p className="p-8 text-body text-muted-foreground">This issue does not exist, or it was deleted.</p>
        )}
      </div>
    </aside>
  );
}

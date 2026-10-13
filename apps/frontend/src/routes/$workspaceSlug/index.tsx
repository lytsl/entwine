import { useWorkspace } from "@entwine/db-collection/react";
import { DEFAULT_QUERY, type IssueQuery } from "@entwine/shared";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { useStore } from "../../hooks/use-store";
import { useViewUrl } from "../../hooks/use-view-url";
import { querySearch } from "../../lib/url";
import { IssuesView } from "./-components/issue-views/issues-view";
import { IssueScope } from "./-components/workspace/issue-scope";

/** Open issues by default: every group but completed and cancelled. */
const MY_DEFAULTS: IssueQuery = { ...DEFAULT_QUERY, groups: ["backlog", "unstarted", "started"] };

export const Route = createFileRoute("/$workspaceSlug/")({
  validateSearch: querySearch(MY_DEFAULTS),
  search: { middlewares: [stripSearchParams(MY_DEFAULTS)] },
  component: ScopedPage,
});

function MyIssues() {
  const { userId } = useWorkspace();
  const { peek, ...query } = Route.useSearch();
  const url = useViewUrl();
  const store = useStore();
  const inScope = store.issues.scope({ assigneeId: userId });
  return <IssuesView title="My issues" icon={<InboxIcon />} inScope={inScope} query={query} peek={peek} {...url} />;
}

function ScopedPage() {
  const { userId } = useWorkspace();
  return (
    <IssueScope scope={{ assigneeId: userId }}>
      <MyIssues />
    </IssueScope>
  );
}

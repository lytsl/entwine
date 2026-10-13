import { DEFAULT_QUERY } from "@entwine/shared";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { LayersIcon } from "lucide-react";
import { useStore } from "../../../hooks/use-store";
import { useViewUrl } from "../../../hooks/use-view-url";
import { activeFilterCount } from "../../../lib/issue-filters";
import { querySearch } from "../../../lib/url";
import { IssuesView } from "../-components/issue-views/issues-view";
import { SaveViewButton } from "../-components/views/save-view-button";

export const Route = createFileRoute("/$workspaceSlug/issues/")({
  validateSearch: querySearch(),
  search: { middlewares: [stripSearchParams(DEFAULT_QUERY)] },
  component: AllIssues,
});

function AllIssues() {
  const { peek, ...query } = Route.useSearch();
  const url = useViewUrl();
  const inScope = useStore().issues.scope({ paged: true });
  return (
    <IssuesView
      title="All issues"
      icon={<LayersIcon />}
      inScope={inScope}
      paged
      query={query}
      peek={peek}
      viewActions={activeFilterCount(query) > 0 && <SaveViewButton query={query} projectId={null} />}
      {...url}
    />
  );
}

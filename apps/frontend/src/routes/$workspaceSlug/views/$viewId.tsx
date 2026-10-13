import { useRows } from "@entwine/db-collection/react";
import { type IssueQuery, readQuery } from "@entwine/shared";
import { createFileRoute, Link, type SearchSchemaInput } from "@tanstack/react-router";
import { ViewIcon } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "../../../components/page-header";
import { ProjectCrumb } from "../../../components/project-crumb";
import { useStore } from "../../../hooks/use-store";
import { savedQuery } from "../../../lib/view";
import { IssuesView } from "../-components/issue-views/issues-view";
import { ProjectArchivedBanner } from "../-components/project/project-archived-banner";
import { IssueScope } from "../-components/workspace/issue-scope";
import { ViewActions } from "./-components/view-actions";

/** `edit` holds the view's settings while they differ from the saved ones, until updated or reset. */
export const Route = createFileRoute("/$workspaceSlug/views/$viewId")({
  validateSearch: (
    search: { edit?: unknown; peek?: unknown } & SearchSchemaInput,
  ): { edit?: IssueQuery; peek?: string } => ({
    ...(search.edit ? { edit: readQuery(search.edit) } : {}),
    ...(typeof search.peek === "string" && search.peek ? { peek: search.peek } : {}),
  }),
  component: ScopedPage,
});

function ViewPage() {
  const { viewId } = Route.useParams();
  const { edit, peek } = Route.useSearch();
  const navigate = Route.useNavigate();
  const store = useStore();
  const view = useRows("View").find((v) => v.id === viewId);
  const scopeId = view?.projectId ?? null;
  const inScope = store.issues.scope({ projectId: scopeId, paged: !scopeId });
  const onPeek = useMemo(
    () => (id: string | null) => void navigate({ to: ".", search: (prev) => ({ ...prev, peek: id ?? undefined }) }),
    [navigate],
  );
  if (!view)
    return (
      <>
        <PageHeader title="View not found" />
        <p className="p-8 text-body text-muted-foreground">
          This view no longer exists.{" "}
          <Link from="/$workspaceSlug" to="/$workspaceSlug/views" className="underline underline-offset-4">
            Back to views
          </Link>
        </p>
      </>
    );
  const saved = savedQuery(view.query);
  const query = edit ?? saved;
  const dirty = edit !== undefined && JSON.stringify(edit) !== JSON.stringify(saved);
  const project = view.projectId ? store.projects.get(view.projectId) : undefined;

  return (
    <IssuesView
      title={view.name}
      icon={<ViewIcon />}
      crumbs={[
        project ? (
          <ProjectCrumb key="project" project={project} />
        ) : (
          <Link
            key="views"
            from="/$workspaceSlug"
            to="/$workspaceSlug/views"
            className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Views
          </Link>
        ),
      ]}
      banner={<ProjectArchivedBanner project={project} />}
      inScope={inScope}
      paged={!scopeId}
      query={query}
      projectId={view.projectId ?? undefined}
      peek={peek}
      onPeek={onPeek}
      onChange={(patch) =>
        navigate({ to: ".", search: (prev) => ({ ...prev, edit: { ...query, ...patch } }), replace: true })
      }
      viewActions={
        dirty && (
          <ViewActions
            view={view}
            query={query}
            store={store}
            onReset={() => void navigate({ to: ".", search: (prev) => ({ peek: prev.peek }), replace: true })}
          />
        )
      }
    />
  );
}

function ScopedPage() {
  const { viewId } = Route.useParams();
  const view = useRows("View").find((v) => v.id === viewId);
  if (!view?.projectId) return <ViewPage />;
  return (
    <IssueScope scope={{ projectId: view.projectId }}>
      <ViewPage />
    </IssueScope>
  );
}

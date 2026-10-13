import { pruneLocalData, SyncProvider } from "@entwine/db-collection/react";
import { syncSchema } from "@entwine/shared";
import { SyncDevtools } from "@entwine/sync-devtools";
import { LoadingPage } from "@entwine/ui/components/ui/page-shell";
import { toast } from "@entwine/ui/components/ui/toast";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { ErrorPage } from "../../components/error-page";
import { lastWorkspace } from "../../preferences/last-workspace";
import { knownWorkspaces, requireSession } from "../../services/guards";
import { renewPush } from "../../services/push";
import { PageNotFound } from "./-components/workspace/page-not-found";
import { Shell } from "./-components/workspace/shell";
import { WorkspaceGone } from "./-components/workspace/workspace-gone";
import { WorkspaceNotFound } from "./-components/workspace/workspace-not-found";

export const Route = createFileRoute("/$workspaceSlug")({
  beforeLoad: async ({ context, location, params }) => {
    const session = await requireSession(context.queryClient, location.href);
    const workspaces = await knownWorkspaces(context.queryClient);
    return { session, workspaces, workspace: workspaces.find((w) => w.slug === params.workspaceSlug) ?? null };
  },
  component: WorkspaceLayout,
  notFoundComponent: PageNotFound,
});

function WorkspaceLayout() {
  const { session, workspaces, workspace } = Route.useRouteContext();
  useEffect(() => {
    if (workspace) lastWorkspace.set(workspace.slug);
  }, [workspace]);
  const memberOf = workspaces.map((w) => w.id).join();
  useEffect(() => {
    void pruneLocalData(session.user.id, memberOf ? memberOf.split(",") : []);
  }, [session.user.id, memberOf]);
  useEffect(() => {
    // One that fails, offline say, is tried again when the app next opens.
    renewPush().catch(() => {});
  }, []);
  if (!workspace) return <WorkspaceNotFound />;
  return (
    <SyncProvider
      // Another workspace starts again, rather than inherit what became of this one.
      key={workspace.id}
      schema={syncSchema}
      url={`/api/w/${workspace.id}`}
      workspaceId={workspace.id}
      userId={session.user.id}
      onError={(error) => toast.error(error.message)}
      loading={<LoadingPage label="Loading workspace…" />}
      revoked={<WorkspaceGone workspace={workspace} />}
      failed={(error, retry) => <ErrorPage error={error} reset={retry} />}
    >
      <Shell workspace={workspace} />
      {import.meta.env.DEV && <SyncDevtools />}
    </SyncProvider>
  );
}

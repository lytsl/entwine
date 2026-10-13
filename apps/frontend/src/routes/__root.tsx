import { PageShell } from "@entwine/ui/components/ui/page-shell";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { useDocumentTitle } from "../hooks/use-document-title";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: PageNotFound,
});

function PageNotFound() {
  useDocumentTitle("Page not found");
  return (
    <PageShell>
      <div className="flex flex-col items-center gap-3 text-sm">
        <h1 className="text-base font-medium">Page not found</h1>
        <p>This page does not exist.</p>
        <Link to="/" className="underline underline-offset-4">
          Go to your workspaces
        </Link>
      </div>
    </PageShell>
  );
}

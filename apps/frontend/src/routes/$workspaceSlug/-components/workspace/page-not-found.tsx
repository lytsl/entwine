import { getRouteApi, Link } from "@tanstack/react-router";
import { PageHeader } from "../../../../components/page-header";

const workspaceRoute = getRouteApi("/$workspaceSlug");

export function PageNotFound() {
  const { workspaceSlug } = workspaceRoute.useParams();
  return (
    <>
      <PageHeader title="Page not found" />
      <p className="p-8 text-body text-muted-foreground">
        This page does not exist.{" "}
        <Link to="/$workspaceSlug" params={{ workspaceSlug }} className="underline underline-offset-4">
          Back to my issues
        </Link>
      </p>
    </>
  );
}

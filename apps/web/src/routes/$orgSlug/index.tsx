import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$orgSlug/")({
	component: RouteComponent,
	staticData: {
		breadcrumbTitle: "Org Index",
	},
});

function RouteComponent() {
	return "/_org/$orgId/";
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$orgId/")({
	component: RouteComponent,
	staticData: {
		breadcrumbTitle: "Org Index",
	},
});

function RouteComponent() {
	return "/_org/$orgId/";
}

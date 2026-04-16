import { createFileRoute } from "@tanstack/react-router";
import AllIssues from "@/components/issues/all-issues";
import MainLayout from "@/components/layout/main-layout";
import Header from "../../-components/issues/header";

export const Route = createFileRoute("/$orgSlug/team/$teamSlug/$view")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<>
			<Header />

			<AllIssues />
		</>
	);
}

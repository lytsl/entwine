import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/(auth)/_auth/add-account")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/_auth/add-account"!</div>;
}

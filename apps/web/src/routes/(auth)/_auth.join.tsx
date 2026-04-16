import { createFileRoute } from "@tanstack/react-router";
import CreateWorkspaceScreen from "./-components/create-new-workspace";

export const Route = createFileRoute("/(auth)/_auth/join")({
	component: RouteComponent,
});

function RouteComponent() {
	return <CreateWorkspaceScreen variant="join" />;
}

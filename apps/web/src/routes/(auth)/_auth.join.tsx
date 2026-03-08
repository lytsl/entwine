import { createFileRoute, useNavigate } from "@tanstack/react-router";
import CreateWorkspaceScreen from "./-components/create-new-workspace";

export const Route = createFileRoute("/(auth)/_auth/join")({
	component: RouteComponent,
});

function RouteComponent({ className, ...props }: React.ComponentProps<"div">) {
	const _navigate = useNavigate({
		from: "/",
	});

	return <CreateWorkspaceScreen variant="join" />;
}

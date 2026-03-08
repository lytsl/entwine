import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/(auth)/_auth")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		const session = await authClient.getSession();

		if (!session?.data) {
			throw redirect({
				to: "/login",
			});
		}

		return {
			...context,
			session,
		};
	},
});

function RouteComponent() {
	return <Outlet />;
}

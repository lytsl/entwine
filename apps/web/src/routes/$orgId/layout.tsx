import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { apiQuery } from "@/utils/api";
import { AppSidebar } from "./-components/app-sidebar";

export const Route = createFileRoute("/$orgId")({
	component: RouteComponent,
	beforeLoad: async ({ context, params }) => {
		const orgSession = await apiQuery.api.auth.organization[
			"get-session"
		].$get.call({ query: { slug: params.orgId } });
		if (!orgSession.ok) {
			if (orgSession.status === 403) {
				throw redirect({
					to: "/",
				});
			}
			throw redirect({
				to: "/login",
			});
		}
		const session = await orgSession.json();

		return {
			...context,
			session,
		};
	},
});

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex min-h-svh flex-1 flex-col bg-sidebar md:min-h-min">
					<div className="m-2 ms-0 flex-1 rounded-md border border-[oklch(0.2655_0.0094_269.8)] bg-background shadow-subtle">
						{/*<header className=" ">
							<div className="flex min-h-10 items-center gap-2 border-b border-b-[oklch(0.2655_0.0094_269.8)] px-4 ps-8 pe-6">
								<SidebarTrigger className="-ml-1" />
								<Separator
									orientation="vertical"
									className="mr-2 data-[orientation=vertical]:h-4"
								/>
								<Breadcrumb>
									<BreadcrumbList>
										<BreadcrumbItem className="hidden md:block">
											<BreadcrumbLink href="#">
												Building Your Application
											</BreadcrumbLink>
										</BreadcrumbItem>
										<BreadcrumbSeparator className="hidden md:block" />
										<BreadcrumbItem>
											<BreadcrumbPage>Data Fetching</BreadcrumbPage>
										</BreadcrumbItem>
									</BreadcrumbList>
								</Breadcrumb>
							</div>
							<div className="min-h-10 border-b border-b-[oklch(0.2655_0.0094_269.8)] ps-8 pe-6" />
						</header>*/}

						<Outlet />
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

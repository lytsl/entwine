import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { createTanStackCollections } from "@/lib/collection-wrapper";
import { idbSchema } from "@/lib/db/schema";
import { createLazyIDB } from "@/lib/idb-wrapper";
import { AppSidebar } from "./-components/app-sidebar";

export const Route = createFileRoute("/$orgSlug")({
	component: RouteComponent,
	beforeLoad: async ({ context, params, ...t }) => {
		sessionStorage.setItem("$orgSlug", params.orgSlug);
		const db = createLazyIDB(params.orgSlug, 1, { stores: idbSchema });
		const collections = createTanStackCollections(db as any, idbSchema);

		const { data: sessionData } = await authClient.getSession();

		if (!sessionData) throw redirect({ to: "/login" });
		if (!sessionData.organization) throw redirect({ to: "/" });

		return {
			...context,
			...sessionData,
			db,
			collections,
			orgSlug: params.orgSlug,
		};
	},
});

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-1 flex-col bg-sidebar md:min-h-min">
					<div className="m-2 ms-0 flex-1 overflow-hidden rounded-md border border-[oklch(0.2655_0.0094_269.8)] bg-background shadow-subtle">
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

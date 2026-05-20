import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import {
	createTanStackCollections,
	type TanStackCollections,
} from "@/lib/collection-wrapper";
import { idbSchema } from "@/lib/db/schema";
import { createLazyIDB, type ExtractZodSchemas } from "@/lib/idb-wrapper";
import { syncEventBus } from "@/lib/sync/events";
import type { WsSyncData } from "@/lib/sync/ws-client";
import { api } from "@/utils/api";
import { AppSidebar } from "./-components/app-sidebar";

export const Route = createFileRoute("/$orgSlug")({
	component: RouteComponent,
	beforeLoad: async ({ context, params }) => {
		sessionStorage.setItem("$orgSlug", params.orgSlug);
		const db = await createLazyIDB(params.orgSlug, 1, { stores: idbSchema });
		const collections = createTanStackCollections(db as any, idbSchema);

		const syncData = await db.get("_metadata", "syncData");
		if (!syncData)
			await db.put(
				"_metadata",
				{
					lastSyncId: 0,
				},
				"syncData",
			);
		const { lastSyncId } = syncData || {
			lastSyncId: 0,
		};

		const deltaData = await api
			.get<{ data: Array<WsSyncData>; lastSyncId: number }>("sync/delta", {
				searchParams: new URLSearchParams({ lastSyncId: String(lastSyncId) }),
				headers: {
					"x-organization-slug": params.orgSlug,
				},
			})
			.then((r) => r.json());
		if (deltaData.data.length > 0 || lastSyncId !== deltaData.lastSyncId) {
			const modelGroupedData = Object.groupBy(
				deltaData.data,
				(d) => d.modelName,
			);
			const tx = db.transaction(
				[...Object.keys(modelGroupedData), "_metadata"] as any,
				"readwrite",
			);

			await Promise.all([
				...Object.entries(modelGroupedData).map(([modelName, data]) =>
					syncEventBus.emit(`${modelName}:sync`, {
						data: data as any,
						tx: tx as any,
						// lastSyncId: deltaData.lastSyncId,
					}),
				),
				tx
					.objectStore("_metadata")
					.put({ lastSyncId: deltaData.lastSyncId }, "syncData"),
				tx.done,
			]);
		}

		await Promise.all(
			Object.keys(idbSchema).map((modelName) =>
				syncEventBus.emit(`${modelName}:markReady`, {
					lastSyncId: deltaData.lastSyncId,
				}),
			),
		);

		const { data: sessionData } = await authClient.getSession();

		if (!sessionData) throw redirect({ to: "/login" });
		if (!sessionData.organization) throw redirect({ to: "/" });

		return {
			// ...context,
			...sessionData,
			db,
			collections,
			orgSlug: params.orgSlug,
		};
	},
});

export type Collections = ExtractZodSchemas<typeof idbSchema>;
export const useOrgRoutContext = () =>
	Route.useRouteContext() as {
		collections: TanStackCollections<typeof idbSchema>;
	};

function RouteComponent() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="h-full bg-sidebar p-2 ps-0">
				<div className="flex h-full flex-col overflow-hidden rounded-md border border-[oklch(0.2655_0.0094_269.8)] bg-background shadow-subtle">
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
			</SidebarInset>
		</SidebarProvider>
	);
}

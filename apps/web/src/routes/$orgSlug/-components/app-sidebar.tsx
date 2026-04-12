"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
	BoxIcon,
	FocusIcon,
	InboxIcon,
	LayersIcon,
	type LucideIcon,
	SquareUserRoundIcon,
	UsersRoundIcon,
} from "lucide-react";
import type * as React from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import {
	type ShortcutRegistryItem,
	shortcutRegistry,
} from "@/lib/shortcut-registry";
import { cn } from "@/lib/utils";
import { Route } from "../layout";
import { NavGroup } from "./nav-group";
import { NavMenuItem } from "./nav-menu-item";
import { NavTeams } from "./nav-teams";
import { OrganizationSwitcher } from "./org-switcher";

const data: {
	id: string;
	items: {
		title: string;
		url: string;
		icon?: LucideIcon;
		tooltip?: ShortcutRegistryItem | string;
	}[];
	label?: string;
}[] = [
	{
		id: "top",
		items: [
			{
				title: "Inbox",
				url: "#",
				icon: InboxIcon,
				tooltip: shortcutRegistry["G->I"],
			},
			{
				title: "My Issues",
				url: "#",
				icon: FocusIcon,
				tooltip: "Open command menu",
			},
		],
	},
	{
		id: "workspace",
		label: "Workspace",
		items: [
			{
				title: "Projects",
				url: "#",
				icon: BoxIcon,
			},
			{
				title: "Views",
				url: "#",
				icon: LayersIcon,
			},
			{
				title: "Members",
				url: "#",
				icon: UsersRoundIcon,
			},
			{
				title: "Teams",
				url: "#",
				icon: SquareUserRoundIcon,
			},
		],
	},
	// {
	// 	label: "Try",
	// 	items: [
	// 		{
	// 			title: "Import issues",
	// 			url: "#",
	// 			icon: IssueIcon,
	// 		},
	// 		{
	// 			title: "Invite People",
	// 			url: "#",
	// 			icon: PlusIcon,
	// 		},
	// 		{
	// 			title: "Link GitHub",
	// 			url: "#",
	// 			icon: GithubIcon,
	// 		},
	// 	],
	// }
];

export function AppSidebar({
	className,
	...props
}: React.ComponentProps<typeof Sidebar>) {
	const { session } = Route.useRouteContext();

	const data = [];
	// const teamData = {
	// 	label: "Your teams",
	// 	items: teamsListQuery.data?.data?.map((team) => ({
	// 		title: team.name,
	// 		url: "#",
	// 		icon: UsersRoundIcon,
	// 		tooltip: shortcutRegistry["G->I"],
	// 	})) || [],
	// }

	return (
		<TooltipProvider delay={600}>
			<Sidebar
				collapsible="icon"
				className={cn("border-0!", className)}
				{...props}
			>
				<SidebarHeader>
					<OrganizationSwitcher />
				</SidebarHeader>

				<SidebarContent className="-mt-1">
					{data.map((item) => (
						<NavGroup key={item.id} label={item.label}>
							{item.items.map((item) => (
								<NavMenuItem item={item} key={item.title} />
							))}
						</NavGroup>
					))}

					<NavTeams />
				</SidebarContent>

				<SidebarFooter>{/* <NavUser user={data.user} /> */}</SidebarFooter>
				<SidebarRail />
			</Sidebar>
		</TooltipProvider>
	);
}

"use client";

import { ChevronRight } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupLabel,
	SidebarMenu,
} from "@/components/ui/sidebar";

export function NavGroup({
	children,
	label,
	action,
}: {
	children: React.ReactNode;
	label?: string;
	action?: React.ReactNode | null;
}) {
	if (!label) {
		return (
			<SidebarGroup>
				<SidebarMenu>{children}</SidebarMenu>
			</SidebarGroup>
		);
	}

	return (
		<Collapsible defaultOpen className="group/sidebar_group">
			<SidebarGroup>
				<CollapsibleTrigger className={"flex items-center gap-2"}>
					<SidebarGroupLabel>
						{label}
						<ChevronRight className="fill-current transition-transform group-data-open/sidebar_group:rotate-90" />
					</SidebarGroupLabel>

					<SidebarGroupAction className="ml-auto">{action}</SidebarGroupAction>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenu>{children}</SidebarMenu>
				</CollapsibleContent>
			</SidebarGroup>
		</Collapsible>
	);
}

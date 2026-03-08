import { ChevronRight, type LucideIcon } from "lucide-react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
} from "@/components/ui/sidebar";
import type { ShortcutRegistryItem } from "@/lib/shortcut-registry";

export const NavMenuItem = ({
	children,
	item,
}: {
	children?: React.ReactNode;
	item: {
		title: string;
		url: string;
		icon?: LucideIcon;
		isActive?: boolean;
		tooltip?: ShortcutRegistryItem | string;
	};
}) => {
	if (!children) {
		return (
			<SidebarMenuItem>
				<SidebarMenuButton tooltip={item?.tooltip} className="ps-1.5 pe-0.5">
					{item.icon && (
						<item.icon className="text-[oklch(0.6698_0.0026_271.4)] group-hover/menu-button:text-inherit" />
					)}
					<span>{item.title}</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	}
	return (
		<Collapsible
			render={<SidebarMenuItem />}
			defaultOpen={item.isActive}
			className="group/sidebar_menu_item"
		>
			<CollapsibleTrigger
				render={
					<SidebarMenuButton tooltip={item.title} className="ps-1.5 pe-0.5" />
				}
			>
				{item.icon && (
					<item.icon className="text-[oklch(0.6698_0.0026_271.4)]" />
				)}
				<span>{item.title}</span>
				<ChevronRight className="ml-auto transition-transform duration-200 group-data-open/sidebar_menu_item:rotate-90" />
			</CollapsibleTrigger>
			<CollapsibleContent>
				<SidebarMenuSub>{children}</SidebarMenuSub>
			</CollapsibleContent>
		</Collapsible>
	);
};

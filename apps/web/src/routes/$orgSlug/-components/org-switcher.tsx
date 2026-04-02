import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Route } from "../layout";
import { CreateNewIssue } from "./create-new-issue";

export function OrganizationSwitcher() {
	const { session } = Route.useRouteContext();
	return (
		<SidebarMenu>
			<SidebarMenuItem className="flex gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<SidebarMenuButton className="ps-1 pe-1.5" />}
					>
						<div
							style={{
								background: (session.organization.metadata as any)?.color,
							}}
							className="inline-flex size-5 items-center justify-center rounded bg-primary text-primary-foreground uppercase"
						>
							{session.organization.name.substring(0, 2)}
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">
								{session.organization.name}
							</span>
						</div>
						<ChevronDownIcon className="ml-auto" />
					</DropdownMenuTrigger>

					<DropdownMenuContent side="bottom" align="end" sideOffset={4}>
						<DropdownMenuGroup>
							<DropdownMenuItem render={<Link to="/" />}>
								Settings
								<DropdownMenuShortcut>G then S</DropdownMenuShortcut>
							</DropdownMenuItem>
							<DropdownMenuItem>Invite and manage members</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>Download desktop app</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									Switch Workspace
								</DropdownMenuSubTrigger>
								<DropdownMenuPortal>
									<DropdownMenuSubContent>
										<DropdownMenuLabel>abc12345@example.com</DropdownMenuLabel>
										<DropdownMenuSeparator />
										<DropdownMenuItem>
											<div className="inline-flex size-5 items-center justify-center rounded bg-primary text-primary-foreground uppercase">
												AB
											</div>
											abc12345
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem>
											Create or join workspace
										</DropdownMenuItem>
										<DropdownMenuItem>Add an account</DropdownMenuItem>
									</DropdownMenuSubContent>
								</DropdownMenuPortal>
							</DropdownMenuSub>
							<DropdownMenuItem>
								Log out
								<DropdownMenuShortcut>⌥⇧Q</DropdownMenuShortcut>
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
				<CreateNewIssue />
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

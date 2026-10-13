import { useWorkspace } from "@entwine/db-collection/react";
import { WorkspaceLogo } from "@entwine/ui/components/icons/workspace-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@entwine/ui/components/ui/sidebar";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BellRingIcon, CheckIcon, ChevronsUpDownIcon, LogOutIcon, PlusIcon, UserIcon } from "lucide-react";
import { useSignOut } from "../../../../hooks/use-sign-out";
import type { WorkspaceInfo } from "../../../../services/auth-client";
import { workspacesQuery } from "../../../../services/queries";
import type { Store } from "../../../../store";
import { ThemeMenu } from "./theme-menu";

export function WorkspaceMenu({ workspace, store }: { workspace: WorkspaceInfo; store: Store }) {
  const { userId } = useWorkspace();
  const workspaces = useQuery(workspacesQuery).data ?? [];
  const me = store.members.get(userId);
  const signOut = useSignOut();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                aria-label={workspace.name}
                className="h-10 data-popup-open:bg-sidebar-accent"
              />
            }
          >
            <WorkspaceLogo name={workspace.name} />
            <span className="min-w-0 flex-1 truncate font-semibold text-sidebar-accent-foreground">
              {workspace.name}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 py-2">
                <UserAvatar user={me} size={28} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-medium text-foreground">{me?.name}</span>
                  <span className="truncate text-caption">{me?.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuLinkItem
                render={<Link to="/$workspaceSlug/settings/profile" params={{ workspaceSlug: workspace.slug }} />}
              >
                <UserIcon />
                Profile
              </DropdownMenuLinkItem>
              <DropdownMenuLinkItem
                render={<Link to="/$workspaceSlug/settings/notifications" params={{ workspaceSlug: workspace.slug }} />}
              >
                <BellRingIcon />
                Notifications
              </DropdownMenuLinkItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuLinkItem
                  key={w.id}
                  render={<Link to="/$workspaceSlug" params={{ workspaceSlug: w.slug }} />}
                >
                  <WorkspaceLogo name={w.name} size={18} />
                  <span className="flex-1 truncate">{w.name}</span>
                  {/* Names are not unique; addresses are. */}
                  {workspaces.some((other) => other.id !== w.id && other.name === w.name) && (
                    <span className="text-caption text-muted-foreground">/{w.slug}</span>
                  )}
                  {w.id === workspace.id && <CheckIcon />}
                </DropdownMenuLinkItem>
              ))}
              <DropdownMenuLinkItem render={<Link to="/new" />}>
                <PlusIcon />
                Create workspace
              </DropdownMenuLinkItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <ThemeMenu />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

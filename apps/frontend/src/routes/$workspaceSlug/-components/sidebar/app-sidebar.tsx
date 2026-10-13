import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@entwine/ui/components/ui/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  BellIcon,
  FolderKanbanIcon,
  InboxIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SquarePenIcon,
  TagIcon,
  UsersIcon,
  ViewIcon,
} from "lucide-react";
import { memo } from "react";
import { UNREAD_SHOWN } from "../../../../constants/notification";
import { useShell } from "../../../../hooks/use-shell";
import { useSingleKeys } from "../../../../hooks/use-single-keys";
import { keyHint, tooltip } from "../../../../lib/shortcuts";
import type { WorkspaceInfo } from "../../../../services/auth-client";
import { type Store, sameButIssues } from "../../../../store";
import { ShortcutKeys } from "../command-palette/shortcut-keys";
import { ProjectItem } from "./project-item";
import { SyncIndicator } from "./sync-indicator";
import { WorkspaceMenu } from "./workspace-menu";

/** The sidebar shows projects and members, no issues: an edit to an issue does not render it again. */
export const AppSidebar = memo(AppSidebarContent, sameButIssues);

function AppSidebarContent({ workspace, store }: { workspace: WorkspaceInfo; store: Store }) {
  const shell = useShell();
  const singleKeys = useSingleKeys();
  const match = useMatchRoute();
  const { setOpenMobile } = useSidebar();
  const params = { workspaceSlug: workspace.slug };
  const active = (to: string, fuzzy = false) => !!match({ to, params, fuzzy });
  const { unread } = store.notifications;

  return (
    <Sidebar
      collapsible="icon"
      role="navigation"
      aria-label="Workspace"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a[href]")) setOpenMobile(false);
      }}
    >
      <SidebarHeader className="gap-2">
        <WorkspaceMenu workspace={workspace} store={store} />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={tooltip("New issue", "newIssue", singleKeys)}
              onClick={() => shell.openNewIssue()}
              className="border bg-background text-foreground shadow-xs hover:bg-accent"
            >
              <SquarePenIcon />
              <span>New issue</span>
              <span className="ml-auto group-data-[collapsible=icon]:hidden">
                <ShortcutKeys id="newIssue" />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={`Search (${keyHint("palette")})`} onClick={() => shell.openPalette()}>
              <SearchIcon />
              <span>Search</span>
              <span className="ml-auto group-data-[collapsible=icon]:hidden">
                <ShortcutKeys id="palette" />
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={unread ? `Inbox (${unread} unread)` : "Inbox"}
                isActive={active("/$workspaceSlug/inbox")}
                render={<Link to="/$workspaceSlug/inbox" params={params} />}
              >
                <BellIcon />
                <span>Inbox</span>
              </SidebarMenuButton>
              {unread > 0 && (
                <SidebarMenuBadge aria-label={`${unread} unread`} data-testid="unread-count">
                  {unread > UNREAD_SHOWN ? `${UNREAD_SHOWN}+` : unread}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="My issues"
                isActive={active("/$workspaceSlug")}
                render={<Link to="/$workspaceSlug" params={params} />}
              >
                <InboxIcon />
                <span>My issues</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="All issues"
                isActive={active("/$workspaceSlug/issues")}
                render={<Link to="/$workspaceSlug/issues" params={params} />}
              >
                <LayersIcon />
                <span>All issues</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Views"
                isActive={active("/$workspaceSlug/views", true)}
                render={<Link to="/$workspaceSlug/views" params={params} />}
              >
                <ViewIcon />
                <span>Views</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Projects"
                isActive={active("/$workspaceSlug/projects")}
                render={<Link to="/$workspaceSlug/projects" params={params} />}
              >
                <FolderKanbanIcon />
                <span>Projects</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Your projects</SidebarGroupLabel>
          <SidebarGroupAction aria-label="New project" title="New project" onClick={() => shell.openCreate("project")}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarMenu>
            {store.projects.active.map((project) => (
              <ProjectItem key={project.id} project={project} workspaceSlug={workspace.slug} />
            ))}
            {store.projects.active.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-muted-foreground" onClick={() => shell.openCreate("project")}>
                  <PlusIcon />
                  <span>Create a project</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="General"
              isActive={active("/$workspaceSlug/settings/general")}
              render={<Link to="/$workspaceSlug/settings/general" params={params} />}
            >
              <SettingsIcon />
              <span>General</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Members"
              isActive={active("/$workspaceSlug/settings/members")}
              render={<Link to="/$workspaceSlug/settings/members" params={params} />}
            >
              <UsersIcon />
              <span>Members</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Labels"
              isActive={active("/$workspaceSlug/settings/labels")}
              render={<Link to="/$workspaceSlug/settings/labels" params={params} />}
            >
              <TagIcon />
              <span>Labels</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SyncIndicator />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

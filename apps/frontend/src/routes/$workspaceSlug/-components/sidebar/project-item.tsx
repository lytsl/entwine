import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@entwine/ui/components/ui/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  ArchiveIcon,
  BoxIcon,
  IterationCcwIcon,
  LayersIcon,
  LinkIcon,
  MoreHorizontalIcon,
  SettingsIcon,
} from "lucide-react";
import { useStore } from "../../../../hooks/use-store";
import { copyText } from "../../../../lib/clipboard";
import { type Project } from "../../../../types/rows";

export function ProjectItem({ project, workspaceSlug }: { project: Project; workspaceSlug: string }) {
  const store = useStore();
  const match = useMatchRoute();
  const params = { workspaceSlug, projectId: project.id };
  const inProject = !!match({ to: "/$workspaceSlug/projects/$projectId", params, fuzzy: true });
  const onIssues = !!match({ to: "/$workspaceSlug/projects/$projectId", params });
  const onCycles = !!match({ to: "/$workspaceSlug/projects/$projectId/cycles", params, fuzzy: true });
  const onModules = !!match({ to: "/$workspaceSlug/projects/$projectId/modules", params, fuzzy: true });
  const onSettings = !!match({ to: "/$workspaceSlug/projects/$projectId/settings", params });
  const onArchives = !!match({ to: "/$workspaceSlug/projects/$projectId/archives", params });
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={project.name}
        isActive={inProject && !onIssues && !onCycles && !onModules && !onSettings && !onArchives}
        render={<Link to="/$workspaceSlug/projects/$projectId" params={params} />}
      >
        <ProjectIcon project={project} size={18} className="-ml-px" />
        <span>{project.name}</span>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger render={<SidebarMenuAction showOnHover aria-label={`${project.name} actions`} />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          <DropdownMenuLinkItem render={<Link to="/$workspaceSlug/projects/$projectId/settings" params={params} />}>
            <SettingsIcon />
            Settings
          </DropdownMenuLinkItem>
          <DropdownMenuLinkItem render={<Link to="/$workspaceSlug/projects/$projectId/archives" params={params} />}>
            <ArchiveIcon />
            Archived issues
          </DropdownMenuLinkItem>
          <DropdownMenuItem onClick={() => copyText(`${location.origin}/${workspaceSlug}/projects/${project.id}`)}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => store.projects.setArchived(project.id, true)}>
            <ArchiveIcon />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {inProject && (
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              isActive={onIssues}
              render={<Link to="/$workspaceSlug/projects/$projectId" params={params} />}
            >
              <LayersIcon />
              <span>Issues</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              isActive={onCycles}
              render={<Link to="/$workspaceSlug/projects/$projectId/cycles" params={params} />}
            >
              <IterationCcwIcon />
              <span>Cycles</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              isActive={onModules}
              render={<Link to="/$workspaceSlug/projects/$projectId/modules" params={params} />}
            >
              <BoxIcon />
              <span>Modules</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              isActive={onSettings}
              render={<Link to="/$workspaceSlug/projects/$projectId/settings" params={params} />}
            >
              <SettingsIcon />
              <span>Settings</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

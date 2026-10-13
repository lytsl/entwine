import type { Progress } from "@entwine/shared";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { Button } from "@entwine/ui/components/ui/button";
import { CircularProgress } from "@entwine/ui/components/ui/circular-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { avatarColor } from "@entwine/ui/components/ui/user-avatar";
import { cn } from "@entwine/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArchiveIcon, ArchiveRestoreIcon, LinkIcon, MoreHorizontalIcon, SettingsIcon } from "lucide-react";
import { useStore } from "../../../../hooks/use-store";
import { copyText } from "../../../../lib/clipboard";
import { type Project } from "../../../../types/rows";

export function ProjectCard({ project, stats }: { project: Project; stats: Progress }) {
  const store = useStore();
  const isArchived = project.archivedAt !== null;
  const color = avatarColor(project.id);
  const params = { projectId: project.id };
  return (
    <li
      aria-label={project.name}
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-lg hover:shadow-black/10",
        isArchived && "opacity-80",
      )}
    >
      <div
        className="relative h-16"
        style={{
          background: `linear-gradient(120deg, color-mix(in oklch, ${color} 32%, transparent), transparent 85%)`,
        }}
      >
        <span className="absolute -bottom-4 left-4 rounded-[7px] bg-card ring-4 ring-card">
          <ProjectIcon project={project} size={36} className="rounded-[7px]" />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2 z-[1] bg-background/40 backdrop-blur"
                aria-label={`${project.name} actions`}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLinkItem
              render={
                <Link
                  from="/$workspaceSlug/projects/"
                  to="/$workspaceSlug/projects/$projectId/settings"
                  params={params}
                />
              }
            >
              <SettingsIcon />
              Settings
            </DropdownMenuLinkItem>
            <DropdownMenuLinkItem
              render={
                <Link
                  from="/$workspaceSlug/projects/"
                  to="/$workspaceSlug/projects/$projectId/archives"
                  params={params}
                />
              }
            >
              <ArchiveIcon />
              Archived issues
            </DropdownMenuLinkItem>
            <DropdownMenuItem onClick={() => copyText(`${location.origin}${location.pathname}/${project.id}`)}>
              <LinkIcon />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => store.projects.setArchived(project.id, !isArchived)}>
              {isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {isArchived ? "Restore" : "Archive"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Link
            from="/$workspaceSlug/projects/"
            to="/$workspaceSlug/projects/$projectId"
            params={params}
            className="truncate font-semibold after:absolute after:inset-0"
          >
            {project.name}
          </Link>
          <span className="rounded bg-muted px-1.5 py-0.5 text-micro font-medium text-muted-foreground">
            {project.identifier}
          </span>
        </div>
        <p className="line-clamp-2 min-h-10 text-body text-muted-foreground">
          {project.description || "No description"}
        </p>
      </div>
      <div className="flex h-11 items-center gap-2 border-t px-4 text-caption text-muted-foreground">
        <CircularProgress value={stats.percent} size={16} label="Progress" />
        <span>
          {stats.done} of {stats.planned} done
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span>
          {stats.total.toLocaleString()} {stats.total === 1 ? "issue" : "issues"}
        </span>
        {isArchived && (
          <Button
            variant="outline"
            size="xs"
            className="relative z-[1] ml-auto"
            onClick={() => store.projects.setArchived(project.id, false)}
          >
            Restore
          </Button>
        )}
      </div>
    </li>
  );
}

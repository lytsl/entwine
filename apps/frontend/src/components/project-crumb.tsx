import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useStore } from "../hooks/use-store";
import { type Project } from "../types/rows";

const PROJECT_PAGES = {
  issues: "/$workspaceSlug/projects/$projectId",
  cycles: "/$workspaceSlug/projects/$projectId/cycles",
  modules: "/$workspaceSlug/projects/$projectId/modules",
  settings: "/$workspaceSlug/projects/$projectId/settings",
  archives: "/$workspaceSlug/projects/$projectId/archives",
} as const;

/** A breadcrumb that switches to the same page of another project. */
export function ProjectCrumb({ project, to = "issues" }: { project: Project; to?: keyof typeof PROJECT_PAGES }) {
  const store = useStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground data-popup-open:bg-accent">
        <ProjectIcon project={project} size={18} />
        <span className="truncate">{project.name}</span>
        <ChevronDownIcon className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {store.projects.active.map((p) => (
          <DropdownMenuLinkItem
            key={p.id}
            render={<Link from="/$workspaceSlug" to={PROJECT_PAGES[to]} params={{ projectId: p.id }} />}
          >
            <ProjectIcon project={p} size={16} />
            <span className="flex-1 truncate">{p.name}</span>
            {p.id === project.id && <CheckIcon />}
          </DropdownMenuLinkItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

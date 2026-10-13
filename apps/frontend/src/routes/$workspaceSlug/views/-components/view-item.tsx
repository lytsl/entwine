import { FILTER_KEYS } from "@entwine/shared";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { Link } from "@tanstack/react-router";
import { LayersIcon, LinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { LAYOUT_OPTIONS } from "../../../../constants/issue-view";
import { copyText } from "../../../../lib/clipboard";
import { timeAgo } from "../../../../lib/dates";
import { savedQuery } from "../../../../lib/view";
import type { Store } from "../../../../store";
import type { View } from "../../../../types/rows";
import { ViewNameDialog } from "../../-components/views/view-name-dialog";

export function ViewItem({ view, store }: { view: View; store: Store }) {
  const [renaming, setRenaming] = useState(false);
  const project = view.projectId ? store.projects.get(view.projectId) : undefined;
  const editable = store.members.canManage(view);
  const creator = store.members.get(view.creatorId);
  const query = savedQuery(view.query);
  const filters = FILTER_KEYS.reduce((sum, key) => sum + (query[key].length ? 1 : 0), 0);
  return (
    <li
      className="group/view relative flex h-14 items-center gap-3 border-b px-5 transition-colors hover:bg-accent/40"
      aria-label={view.name}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground [&_svg]:size-4">
        {LAYOUT_OPTIONS[query.layout].icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          from="/$workspaceSlug"
          to="/$workspaceSlug/views/$viewId"
          params={{ viewId: view.id }}
          className="truncate text-body font-medium after:absolute after:inset-0"
        >
          {view.name}
        </Link>
        <span className="truncate text-caption text-muted-foreground">
          {filters === 0 ? "No filters" : `${filters} ${filters === 1 ? "filter" : "filters"}`} · updated{" "}
          {timeAgo(view.updatedAt)}
        </span>
      </div>
      <span className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption text-muted-foreground">
        {project ? <ProjectIcon project={project} size={14} /> : <LayersIcon className="size-3.5" />}
        {project?.name ?? "All issues"}
      </span>
      <span title={`Created by ${creator?.name ?? "someone"}`}>
        <UserAvatar user={creator} size={22} />
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" className="relative z-[1]" aria-label={`${view.name} actions`} />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={!editable} onClick={() => setRenaming(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyText(`${location.origin}${location.pathname}/${view.id}`)}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={!editable} onClick={() => store.views.delete(view.id)}>
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {renaming && (
        <ViewNameDialog
          title="Rename view"
          submitLabel="Rename"
          initialName={view.name}
          onClose={() => setRenaming(false)}
          onSubmit={(name) => store.views.update(view.id, { name })}
        />
      )}
    </li>
  );
}

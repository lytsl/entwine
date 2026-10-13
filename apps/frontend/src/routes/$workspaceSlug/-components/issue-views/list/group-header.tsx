import { cn } from "@entwine/ui/lib/utils";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Group, LayoutProps } from "../../../../../types/issue-view";

export function GroupHeader({
  group,
  open,
  onToggle,
  onNewIssue,
}: {
  group: Group;
  open: boolean;
  onToggle(): void;
  onNewIssue: LayoutProps["onNewIssue"];
}) {
  return (
    <div className="sticky top-0 z-[2] flex h-9 items-center gap-1 border-b bg-muted/60 pr-3 pl-2 backdrop-blur supports-[backdrop-filter]:bg-muted/40">
      <h2 className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-body hover:bg-accent/60"
          onClick={onToggle}
        >
          <ChevronRightIcon
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          />
          <span className="flex size-4 shrink-0 items-center justify-center">{group.icon}</span>
          <span className="truncate font-medium">{group.name}</span>
          <span className="text-caption text-muted-foreground tabular-nums">{group.issues.length}</span>
        </button>
      </h2>
      {group.seed && (
        <button
          type="button"
          aria-label={`New issue in ${group.name}`}
          title={`New issue in ${group.name}`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => group.seed && onNewIssue(group.seed)}
        >
          <PlusIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

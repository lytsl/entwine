/** Dropping a card sets the grouped property; a folded column is a narrow strip that still takes drops. */
import type { DisplayProperty, GroupBy } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { ChevronsLeftRightIcon } from "lucide-react";
import { type DragEvent, useMemo, useState } from "react";
import { useShownOrder } from "../../../../../hooks/use-shown-order";
import { dropPatch, groupIssues } from "../../../../../lib/issue-groups";
import { type Group, type LayoutProps } from "../../../../../types/issue-view";
import { Column } from "./column";

/** The property a column already says, left off its cards. */
const GROUPED_PROPERTY: Partial<Record<GroupBy, DisplayProperty>> = {
  state: "state",
  priority: "priority",
  assignee: "assignee",
};

export function IssueBoard({
  issues,
  query,
  store,
  projectId,
  collapsed,
  onToggleGroup,
  onNewIssue,
  peekId,
  onPeek,
  focusedId,
  order,
}: LayoutProps) {
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const by = query.group === "none" ? "state" : query.group;
  // Scrolling a column renders it alone; the groups are made once per change of the view.
  const groups = useMemo(() => groupIssues(by, query, store, issues, projectId), [by, query, store, issues, projectId]);
  useShownOrder(
    order,
    useMemo(
      () => groups.flatMap((group) => (collapsed.has(group.key) ? [] : group.issues.map((issue) => issue.id))),
      [groups, collapsed],
    ),
  );
  const drop = (group: Group) => (event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    // A card that changes column is rendered anew there, and the old one never hears the drag end.
    setDragging(null);
    const issue = store.issues.get(event.dataTransfer.getData("text/issue-id"));
    const patch = issue && dropPatch(group, issue);
    if (issue && patch) void store.issues.update(issue.id, patch);
  };
  const dropTarget = (group: Group) => ({
    onDragOver: (event: DragEvent) => {
      if (!group.patch) return;
      event.preventDefault();
      setOver(group.key);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null);
    },
    onDrop: drop(group),
  });

  return (
    <div className="flex h-full gap-2.5 overflow-x-auto p-3">
      {groups.map((group) =>
        collapsed.has(group.key) ? (
          <section
            key={group.key}
            aria-label={group.name}
            className={cn(
              "flex h-full w-10 shrink-0 cursor-pointer flex-col items-center gap-2 rounded-lg bg-muted/50 py-2.5 transition-colors hover:bg-muted",
              over === group.key && "bg-primary/10 ring-1 ring-primary/40",
            )}
            {...dropTarget(group)}
          >
            <button
              type="button"
              aria-label={`Expand ${group.name}`}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              onClick={() => onToggleGroup(group.key)}
            >
              <ChevronsLeftRightIcon className="size-3.5" />
            </button>
            <span className="flex size-4 items-center justify-center">{group.icon}</span>
            <span className="text-caption text-muted-foreground tabular-nums">{group.issues.length}</span>
            <h2 className="text-body font-medium [writing-mode:vertical-rl]">{group.name}</h2>
          </section>
        ) : (
          <Column
            key={group.key}
            group={group}
            store={store}
            properties={query.properties}
            skip={GROUPED_PROPERTY[by]}
            over={over === group.key}
            dropTarget={dropTarget(group)}
            dragging={dragging}
            onDragChange={setDragging}
            onToggle={() => onToggleGroup(group.key)}
            onNewIssue={onNewIssue}
            peekId={peekId}
            onPeek={onPeek}
            focusedId={focusedId}
          />
        ),
      )}
    </div>
  );
}

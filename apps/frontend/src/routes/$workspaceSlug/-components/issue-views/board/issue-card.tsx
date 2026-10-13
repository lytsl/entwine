import type { DisplayProperty } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { useRangeClick } from "../../../../../hooks/use-range-click";
import type { Store } from "../../../../../store";
import type { LayoutProps } from "../../../../../types/issue-view";
import type { Issue } from "../../../../../types/rows";
import { IssueLink } from "../issue-link";
import { IssueContextMenu } from "../issue-menu/issue-context-menu";
import { IssueQuickActions } from "../issue-menu/issue-quick-actions";
import { IssueProperties } from "../issue-properties";
import { SelectBox } from "../select-box";

export function IssueCard({
  issue,
  store,
  properties,
  skip,
  peeked,
  focused,
  dragging,
  onDragChange,
  onPeek,
}: {
  issue: Issue;
  store: Store;
  properties: LayoutProps["query"]["properties"];
  skip?: DisplayProperty;
  peeked: boolean;
  focused: boolean;
  dragging: boolean;
  onDragChange(dragging: boolean): void;
  onPeek(issueId: string): void;
}) {
  const rangeClick = useRangeClick();
  const key = store.issues.key(issue);
  return (
    <IssueContextMenu
      issue={issue}
      store={store}
      render={
        <article
          aria-label={`${key} ${issue.title}`}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/issue-id", issue.id);
            event.dataTransfer.effectAllowed = "move";
            onDragChange(true);
          }}
          onDragEnd={() => onDragChange(false)}
          onClick={(event) =>
            event.currentTarget.contains(event.target as Node) && !rangeClick(event, issue.id) && onPeek(issue.id)
          }
          className={cn(
            "group/card flex cursor-pointer flex-col gap-1.5 rounded-lg border bg-card p-3 shadow-xs transition-[border-color,box-shadow,opacity] hover:border-foreground/15 hover:shadow-sm data-popup-open:border-foreground/15",
            peeked && "border-primary/50 ring-1 ring-primary/30",
            "data-focused:border-ring data-focused:ring-1 data-focused:ring-ring",
            dragging && "opacity-40",
          )}
          data-testid="issue-card"
          data-issue-id={issue.id}
          data-focused={focused || undefined}
        />
      }
    >
      <div className="flex h-5 items-center gap-2 text-caption text-muted-foreground">
        <SelectBox
          issueId={issue.id}
          label={key}
          className="hover-reveal group-hover/card:opacity-100 focus-visible:opacity-100"
        />
        {properties.includes("key") && <span className="font-medium tabular-nums">{key}</span>}
        <IssueQuickActions
          issue={issue}
          store={store}
          className="-mr-1 ml-auto hover-reveal group-hover/card:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
        />
      </div>
      <IssueLink issue={issue} className="line-clamp-2 text-body leading-snug font-medium" />
      <div className="mt-1 flex flex-wrap items-center gap-1 empty:hidden">
        <IssueProperties issue={issue} store={store} properties={properties} skip={skip} />
      </div>
    </IssueContextMenu>
  );
}

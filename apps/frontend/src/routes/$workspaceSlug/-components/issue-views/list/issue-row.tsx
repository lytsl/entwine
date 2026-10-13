import { cn } from "@entwine/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { memo } from "react";
import { useRangeClick } from "../../../../../hooks/use-range-click";
import { type Store, sameButIssues } from "../../../../../store";
import type { LayoutProps } from "../../../../../types/issue-view";
import { type Issue } from "../../../../../types/rows";
import { IssueLink } from "../issue-link";
import { IssueQuickActions } from "../issue-menu/issue-quick-actions";
import { IssueProperties } from "../issue-properties";
import { SelectBox } from "../select-box";

/** The properties a row keeps at any width. */
const NARROW: readonly string[] = ["state", "priority"];

/** Below the width that fits every property, a pill shows its icon without its name. */
const ICONS_WHEN_NARROW = "contents [&_.truncate]:hidden @min-[48rem]/list:[&_.truncate]:inline";

interface IssueRowProps {
  issue: Issue;
  store: Store;
  /** The issue's revision in the store: with the store's epoch, all a row shows of it. */
  rev: number;
  properties: LayoutProps["query"]["properties"];
  keyWidth: number;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggle(issueId: string): void;
  peeked: boolean;
  menu: boolean;
  focused: boolean;
  onPeek(issueId: string): void;
}

/**
 * Scrolling renders the list at every frame, and every edit hands it a new store object: a row renders again only
 * when what it shows has changed. The stores in the object a row keeps are the workspace's own, so they read the
 * issues as they are.
 */
export const IssueRow = memo(IssueRowContent, sameButIssues);

function IssueRowContent({
  issue,
  store,
  properties,
  keyWidth,
  depth,
  expandable,
  expanded,
  onToggle,
  peeked,
  menu,
  focused,
  onPeek,
}: IssueRowProps) {
  const key = store.issues.key(issue);
  const rangeClick = useRangeClick();
  return (
    // A group named after the issue: a screen reader says whose state, priority and menu the row's buttons are.
    <div
      role="group"
      aria-label={`${key} ${issue.title}`}
      data-testid="issue-row"
      data-issue-id={issue.id}
      data-focused={focused || undefined}
      data-popup-open={menu || undefined}
      className={cn(
        "group/row relative flex h-11 cursor-pointer items-center gap-2 border-b pr-3 transition-colors hover:bg-accent/40 data-popup-open:bg-accent/40",
        "data-focused:bg-accent/50 data-focused:ring-1 data-focused:ring-ring data-focused:ring-inset",
        peeked && "bg-accent/60 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary",
      )}
      style={{ paddingLeft: 16 + depth * 22 }}
      onClick={(event) => {
        // Clicks inside a menu or dialog opened from the row arrive here through React's portal bubbling.
        if (event.currentTarget.contains(event.target as Node) && !rangeClick(event, issue.id)) onPeek(issue.id);
      }}
    >
      <SelectBox
        issueId={issue.id}
        label={key}
        className="hover-reveal group-hover/row:opacity-100 focus-visible:opacity-100"
      />
      {properties.includes("key") && (
        <span
          // A narrow row gives the key's room to the title.
          className="hidden shrink-0 text-caption font-medium text-muted-foreground tabular-nums @min-[48rem]/list:inline"
          style={{ minWidth: `${keyWidth}ch` }}
        >
          {key}
        </span>
      )}
      <span className="flex size-4 shrink-0 items-center justify-center">
        {expandable && (
          <button
            type="button"
            aria-label={`${expanded ? "Collapse" : "Expand"} sub-issues of ${key}`}
            aria-expanded={expanded}
            className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(issue.id);
            }}
          >
            <ChevronRightIcon className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        )}
      </span>
      <IssueLink issue={issue} className="min-w-0 flex-1 truncate text-body font-medium" />
      <div className="ml-auto flex shrink-0 items-center gap-1.5 @min-[48rem]/list:pl-4">
        {/* A narrow row keeps state and priority before the rest and the assignee after, as icons. */}
        <span className={ICONS_WHEN_NARROW}>
          <IssueProperties issue={issue} store={store} properties={properties.filter((p) => NARROW.includes(p))} />
        </span>
        <span className="hidden items-center gap-1.5 @min-[48rem]/list:contents">
          <IssueProperties
            issue={issue}
            store={store}
            properties={properties.filter((p) => !NARROW.includes(p) && p !== "assignee")}
          />
        </span>
        <span className={ICONS_WHEN_NARROW}>
          <IssueProperties issue={issue} store={store} properties={properties.filter((p) => p === "assignee")} />
        </span>
        <IssueQuickActions
          issue={issue}
          store={store}
          className="@min-[48rem]/list:hover-reveal group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
        />
      </div>
    </div>
  );
}

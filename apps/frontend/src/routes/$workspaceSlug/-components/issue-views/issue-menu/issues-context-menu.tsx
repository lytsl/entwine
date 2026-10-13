import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@entwine/ui/components/ui/context-menu";
import { type ReactElement, type ReactNode, useState } from "react";
import { isTypingTarget } from "../../../../../lib/shortcuts";
import type { Store } from "../../../../../store";
import { IssueMenuItems } from "./issue-menu-items";

/**
 * One right-click menu for a layout of very many issues, since a menu each would be mounted with every row scrolled
 * to: `render` is the element that holds them all, and the menu is of the issue whose element (`data-issue-id`) was
 * clicked. `onIssue` hears which issue's menu is open, or null.
 */
export function IssuesContextMenu({
  store,
  render,
  onIssue,
  children,
}: {
  store: Store;
  render: ReactElement;
  onIssue(issueId: string | null): void;
  children: ReactNode;
}) {
  // Kept after the menu closes, while it fades.
  const [issueId, setIssueId] = useState<string | null>(null);
  const issue = issueId ? store.issues.get(issueId) : undefined;
  return (
    <ContextMenu onOpenChange={(open) => !open && onIssue(null)}>
      <ContextMenuTrigger
        render={render}
        className="select-auto"
        onContextMenu={(event) => {
          const target = event.target as Element;
          const id = target.closest<HTMLElement>("[data-issue-id]")?.dataset.issueId;
          if (!id || !event.currentTarget.contains(target) || isTypingTarget(target))
            return event.preventBaseUIHandler();
          setIssueId(id);
          onIssue(id);
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {issue && <IssueMenuItems issue={issue} store={store} />}
      </ContextMenuContent>
    </ContextMenu>
  );
}

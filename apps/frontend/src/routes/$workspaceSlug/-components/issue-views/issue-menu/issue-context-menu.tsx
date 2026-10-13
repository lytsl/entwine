import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@entwine/ui/components/ui/context-menu";
import { type ReactElement, type ReactNode } from "react";
import { isTypingTarget } from "../../../../../lib/shortcuts";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { IssueMenuItems } from "./issue-menu-items";

/**
 * Makes `render` (a row, card or calendar item) open the issue's menu on right-click. A right-click in a text field,
 * or in a popup opened from the element (which React bubbles here through its portal), keeps the browser's menu.
 */
export function IssueContextMenu({
  issue,
  store,
  render,
  children,
}: {
  issue: Issue;
  store: Store;
  render: ReactElement;
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={render}
        className="select-auto"
        onContextMenu={(event) => {
          if (!event.currentTarget.contains(event.target as Node) || isTypingTarget(event.target))
            event.preventBaseUIHandler();
        }}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <IssueMenuItems issue={issue} store={store} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

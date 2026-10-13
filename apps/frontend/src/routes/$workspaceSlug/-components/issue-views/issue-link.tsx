import { cn } from "@entwine/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useContext } from "react";
import { PeekContext } from "../../../../contexts/peek";
import type { Issue } from "../../../../types/rows";

/** Whether a click is a plain one, which peeks, rather than one asking for a new tab or window. */
const plainClick = (event: React.MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** Inside a view a plain click peeks instead; a modified click still opens the page in a new tab. */
export function IssueLink({ issue, className, children }: { issue: Issue; className?: string; children?: ReactNode }) {
  const peek = useContext(PeekContext);
  return (
    <Link
      from="/$workspaceSlug"
      to="/$workspaceSlug/issues/$issueId"
      params={{ issueId: issue.id }}
      className={cn("outline-none focus-visible:underline", className)}
      draggable={false}
      onClick={(event) => {
        event.stopPropagation();
        if (peek && plainClick(event)) {
          event.preventDefault();
          peek(issue.id);
        }
      }}
    >
      {children ?? issue.title}
    </Link>
  );
}

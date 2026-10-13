import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { cn } from "@entwine/ui/lib/utils";
import type { LayoutProps } from "../../../../../types/issue-view";
import type { Issue } from "../../../../../types/rows";
import { IssueLink } from "../issue-link";
import { IssueContextMenu } from "../issue-menu/issue-context-menu";

/** `roomy` is the narrow calendar's row: taller for a finger, and not dragged. */
export function DayIssue({
  issue,
  store,
  peeked,
  onPeek,
  roomy = false,
}: Pick<LayoutProps, "store" | "onPeek"> & { issue: Issue; peeked: boolean; roomy?: boolean }) {
  const state = store.states.get(issue.stateId);
  return (
    <IssueContextMenu
      issue={issue}
      store={store}
      render={
        <div
          draggable={!roomy}
          onDragStart={(event) => event.dataTransfer.setData("text/issue-id", issue.id)}
          onClick={() => onPeek(issue.id)}
          title={`${store.issues.key(issue)}: ${issue.title}`}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-md border bg-card shadow-xs transition-colors hover:border-foreground/15",
            roomy ? "h-10 px-3 text-body" : "h-6 px-1.5 py-1 text-caption",
            peeked && "border-primary/50",
          )}
          data-testid="calendar-issue"
        />
      }
    >
      {state && <StateIcon type={state.group} color={state.color} className="size-3!" />}
      <span className="shrink-0 text-muted-foreground tabular-nums">{store.issues.key(issue)}</span>
      <IssueLink issue={issue} className="min-w-0 flex-1 truncate" />
    </IssueContextMenu>
  );
}

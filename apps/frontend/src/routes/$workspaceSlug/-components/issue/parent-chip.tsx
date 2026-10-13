import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { IssueLink } from "../issue-views/issue-link";

export function ParentChip({ issue, store }: { issue: Issue; store: Store }) {
  const parent = issue.parentId ? store.issues.get(issue.parentId) : undefined;
  if (!parent) return null;
  const state = store.states.get(parent.stateId);
  return (
    <IssueLink
      issue={parent}
      className="inline-flex max-w-full items-center gap-1.5 self-start rounded-md border bg-card px-2 py-1 text-caption text-muted-foreground hover:text-foreground"
    >
      <span className="sr-only">Sub-issue of </span>
      {state && <span className="size-2 shrink-0 rounded-full" style={{ background: state.color }} />}
      <span className="font-medium">{store.issues.key(parent)}</span>
      <span className="truncate">{parent.title}</span>
    </IssueLink>
  );
}

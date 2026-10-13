import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import type { ReactNode } from "react";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { IssueLink } from "../../issue-views/issue-link";

export function IssueLine({ issue, store, children }: { issue: Issue; store: Store; children?: ReactNode }) {
  const state = store.states.get(issue.stateId);
  return (
    <li className="group/line flex h-9 items-center gap-2 rounded-md px-2 text-body hover:bg-accent/50">
      {state && <StateIcon type={state.group} color={state.color} />}
      <span className="w-16 shrink-0 text-caption font-medium text-muted-foreground tabular-nums">
        {store.issues.key(issue)}
      </span>
      <IssueLink issue={issue} className="min-w-0 flex-1 truncate" />
      {children}
    </li>
  );
}

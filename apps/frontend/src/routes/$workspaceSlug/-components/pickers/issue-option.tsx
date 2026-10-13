import type { StateGroup } from "@entwine/shared";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { CommandItem } from "@entwine/ui/components/ui/command";
import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";

export function IssueOption({ issue, store, onSelect }: { issue: Issue; store: Store; onSelect(): void }) {
  const state = store.states.get(issue.stateId);
  return (
    <CommandItem className="text-body" onSelect={onSelect}>
      {state && <StateIcon type={state.group} color={state.color} />}
      <span className="w-16 shrink-0 text-caption text-muted-foreground">{store.issues.key(issue)}</span>
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
    </CommandItem>
  );
}

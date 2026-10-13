import { Button } from "@entwine/ui/components/ui/button";
import { propertyTriggerVariants } from "@entwine/ui/components/ui/property-select";
import { XIcon } from "lucide-react";
import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { IssuePicker } from "../pickers/issue-picker";

/** Chosen from the project's issues outside the issue's own subtree. */
export function ParentPicker({ issue, store }: { issue: Issue; store: Store }) {
  const parent = issue.parentId ? store.issues.get(issue.parentId) : undefined;
  const candidates = () => {
    const subtree = store.issues.subtreeOf(issue.id);
    return store.issues.list(store.issues.scope({ projectId: issue.projectId })).filter((i) => !subtree.has(i.id));
  };
  return (
    <div className="flex w-full items-center">
      <IssuePicker
        store={store}
        issues={candidates}
        placeholder="Choose a parent…"
        onSelect={(next) => store.issues.update(issue.id, { parentId: next.id })}
        trigger={
          <button type="button" aria-label="Parent" className={propertyTriggerVariants({ face: "field" })}>
            {parent ? (
              <span className="truncate">
                <span className="text-muted-foreground">{store.issues.key(parent)}</span> {parent.title}
              </span>
            ) : (
              <span className="text-muted-foreground">No parent</span>
            )}
          </button>
        }
      />
      {parent && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Remove parent"
          onClick={() => store.issues.update(issue.id, { parentId: null })}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}

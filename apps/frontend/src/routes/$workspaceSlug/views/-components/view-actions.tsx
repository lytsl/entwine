import type { IssueQuery } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { RotateCcwIcon, SaveIcon } from "lucide-react";
import type { Store } from "../../../../store";
import type { View } from "../../../../types/rows";
import { SaveViewButton } from "../../-components/views/save-view-button";

/** A changed saved view's actions: Reset, and Update for those who may change it, Save as new for the rest. */
export function ViewActions({
  view,
  query,
  store,
  onReset,
}: {
  view: View;
  query: IssueQuery;
  store: Store;
  onReset(): void;
}) {
  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 text-body" onClick={onReset}>
        <RotateCcwIcon />
        Reset
      </Button>
      {store.members.canManage(view) ? (
        <Button
          size="sm"
          className="h-7 text-body"
          onClick={() => {
            void store.views.update(view.id, { query });
            onReset();
          }}
        >
          <SaveIcon />
          Update view
        </Button>
      ) : (
        <SaveViewButton query={query} projectId={view.projectId} label="Save as new view" />
      )}
    </>
  );
}

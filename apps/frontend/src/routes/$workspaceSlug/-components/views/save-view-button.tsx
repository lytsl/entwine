import type { IssueQuery } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { BookmarkPlusIcon } from "lucide-react";
import { useState } from "react";
import { useOpenView } from "../../../../hooks/use-open-view";
import { useStore } from "../../../../hooks/use-store";
import { ViewNameDialog } from "./view-name-dialog";

export function SaveViewButton({
  query,
  projectId,
  label = "Save view",
}: {
  query: IssueQuery;
  projectId: string | null;
  label?: string;
}) {
  const store = useStore();
  const openView = useOpenView();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="h-7 text-body" onClick={() => setOpen(true)}>
        <BookmarkPlusIcon />
        {label}
      </Button>
      {open && (
        <ViewNameDialog
          title="Save view"
          description="Everyone in the workspace can open the view, with these filters and this display."
          submitLabel="Save view"
          onClose={() => setOpen(false)}
          onSubmit={(name) => openView(store.views.create({ name, projectId, query }))}
        />
      )}
    </>
  );
}

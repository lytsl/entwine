import { Checkbox } from "@entwine/ui/components/ui/checkbox";
import { cn } from "@entwine/ui/lib/utils";
import { useContext } from "react";
import { SelectionContext } from "../../../../contexts/selection";

/** Shown on hover (`className` names the row's hover group) and while any issue is selected. */
export function SelectBox({ issueId, label, className }: { issueId: string; label: string; className?: string }) {
  const selection = useContext(SelectionContext);
  if (!selection) return null;
  const checked = selection.selected.has(issueId);
  return (
    <Checkbox
      aria-label={`Select ${label}`}
      checked={checked}
      className={cn("bg-background", selection.selected.size === 0 && className)}
      onClick={(event) => {
        event.stopPropagation();
        selection.pick(issueId, event.shiftKey);
      }}
    />
  );
}

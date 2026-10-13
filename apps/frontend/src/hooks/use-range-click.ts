import { type MouseEvent, useContext } from "react";
import { SelectionContext } from "../contexts/selection";

/** Shift-click on a row selects a range instead of opening the issue; answers whether it did. */
export function useRangeClick() {
  const selection = useContext(SelectionContext);
  return (event: MouseEvent, issueId: string): boolean => {
    if (!selection || !event.shiftKey) return false;
    selection.pick(issueId, true);
    return true;
  };
}

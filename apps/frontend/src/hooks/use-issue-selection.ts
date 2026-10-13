import { type RefObject, useMemo, useRef, useState } from "react";
import { toggledSet } from "../lib/toggle";
import type { Selection } from "../types/issue-view";

/** `order` holds the ids the layout shows, in on-screen order, which a Shift-click range is taken from. */
export function useIssueSelection(order: RefObject<readonly string[]>) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  /** The issue picked last, where a Shift-click range starts. */
  const anchor = useRef<string | null>(null);
  // Every row reads the selection, so it is a new object only when the selected issues change.
  const selection = useMemo<Selection>(
    () => ({
      selected,
      pick(issueId, range) {
        const ids = order.current;
        const from = anchor.current ? ids.indexOf(anchor.current) : -1;
        const to = ids.indexOf(issueId);
        setSelected((prev) =>
          range && from >= 0 && to >= 0
            ? new Set([...prev, ...ids.slice(Math.min(from, to), Math.max(from, to) + 1)])
            : toggledSet(prev, issueId),
        );
        anchor.current = issueId;
      },
    }),
    [selected, order],
  );
  return { selection, setSelected };
}

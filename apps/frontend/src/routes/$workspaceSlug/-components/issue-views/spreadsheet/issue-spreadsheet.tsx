/** The table is given only the rows the virtualizer picks: a row model of every issue was remade on every edit. */
import type { DisplayProperty } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { OVERSCAN } from "../../../../../constants/issue-view";
import { useRangeClick } from "../../../../../hooks/use-range-click";
import { useShownOrder } from "../../../../../hooks/use-shown-order";
import { type LayoutProps } from "../../../../../types/issue-view";
import { IssueContextMenu } from "../issue-menu/issue-context-menu";
import { columns, features, ISSUE_COLUMN, PROJECT_COLUMN, PROPERTY_COLUMNS } from "./columns";

/** The heights `h-9` gives the header row and `h-10` every other row. */
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 40;

export function IssueSpreadsheet({ issues, query, store, projectId, peekId, focusedId, order }: LayoutProps) {
  const rangeClick = useRangeClick();
  useShownOrder(
    order,
    useMemo(() => issues.map((issue) => issue.id), [issues]),
  );
  const showKey = query.properties.includes("key");
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: useCallback((index: number) => issues[index].id, [issues]),
    overscan: OVERSCAN,
    // Rows start under the header row, which stays at the top: a row scrolled to must clear it.
    paddingStart: HEADER_HEIGHT,
    scrollPaddingStart: HEADER_HEIGHT,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const first = virtualRows[0]?.index ?? 0;
  const last = virtualRows.at(-1)?.index ?? -1;
  const table = useTable({
    features,
    columns,
    data: useMemo(() => issues.slice(first, last + 1), [issues, first, last]),
    getRowId: (issue) => issue.id,
    meta: useMemo(() => ({ store, showKey }), [store, showKey]),
    // The view's display properties decide which columns show; the table never changes that itself.
    state: {
      columnVisibility: useMemo(
        () => ({
          ...Object.fromEntries(
            Object.keys(PROPERTY_COLUMNS).map((property) => [
              property,
              query.properties.includes(property as DisplayProperty),
            ]),
          ),
          [PROJECT_COLUMN]: !projectId,
        }),
        [query.properties, projectId],
      ),
    },
  });
  const { rows } = table.getRowModel();
  // The rows left out above and below, as the height of one empty row each: the table stays a table, so its layout,
  // the header row and the issue column behave as they would with every row in it.
  const before = (virtualRows[0]?.start ?? HEADER_HEIGHT) - HEADER_HEIGHT;
  const after = virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? HEADER_HEIGHT);
  const spacer = (height: number) =>
    height > 0 && (
      <tr aria-hidden>
        <td className="p-0" style={{ height }} />
      </tr>
    );

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a move of the focus scrolls, not a change of the rows under it.
  useEffect(() => {
    const index = focusedId ? issues.findIndex((issue) => issue.id === focusedId) : -1;
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [focusedId]);

  return (
    <div ref={scroller} className="h-full overflow-auto">
      {/* A fixed layout: widths come from the columns, not from whichever rows happen to be rendered. */}
      <table
        className="min-w-full table-fixed border-separate border-spacing-0 text-body"
        style={{ width: table.getTotalSize() }}
        aria-label="Issues"
      >
        <thead className="sticky top-0 z-[3]">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    "h-9 border-r border-b bg-muted/60 px-2.5 text-left text-caption font-medium whitespace-nowrap text-muted-foreground",
                    header.column.id === ISSUE_COLUMN && "sticky left-0 z-[1] backdrop-blur",
                  )}
                  style={{ width: header.getSize() }}
                >
                  <table.FlexRender header={header} />
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {spacer(before)}
          {rows.map((row) => {
            const issue = row.original;
            return (
              <IssueContextMenu
                key={row.id}
                issue={issue}
                store={store}
                render={
                  <tr
                    aria-label={store.issues.key(issue)}
                    className="group/row"
                    data-issue-id={issue.id}
                    data-focused={focusedId === issue.id || undefined}
                    onClick={(event) =>
                      event.currentTarget.contains(event.target as Node) && rangeClick(event, issue.id)
                    }
                  />
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={cn(
                      "h-10 border-r border-b",
                      cell.column.id === ISSUE_COLUMN
                        ? "sticky left-0 z-[1] bg-background px-3 group-hover/row:bg-muted group-data-focused/row:bg-muted group-data-focused/row:shadow-[inset_2px_0_0_var(--ring)]"
                        : "p-0 group-hover/row:bg-muted/40",
                      cell.column.id === ISSUE_COLUMN && peekId === issue.id && "bg-muted",
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </IssueContextMenu>
            );
          })}
          {spacer(after)}
        </tbody>
      </table>
    </div>
  );
}

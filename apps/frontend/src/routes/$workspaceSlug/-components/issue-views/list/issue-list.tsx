/**
 * An expanded issue shows its sub-issues whatever the filters, though never past the cycle or module the view is
 * limited to. Headers, rows, sub-issues and quick-add lines are one flat array of fixed-height items, of which
 * TanStack Virtual picks the ones near the viewport.
 */
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OVERSCAN } from "../../../../../constants/issue-view";
import { useShownOrder } from "../../../../../hooks/use-shown-order";
import { groupIssues } from "../../../../../lib/issue-groups";
import { flatten, type Item } from "../../../../../lib/issue-list";
import { toggledSet } from "../../../../../lib/toggle";
import { type Group, type LayoutProps } from "../../../../../types/issue-view";
import type { Issue } from "../../../../../types/rows";
import { IssuesContextMenu } from "../issue-menu/issues-context-menu";
import { QuickAdd } from "../quick-add";
import { GroupHeader } from "./group-header";
import { IssueRow } from "./issue-row";

/** The heights the items' classes give them (`h-9`, `h-11`, `h-10`), so that nothing has to be measured. */
const HEIGHTS: Record<Item["kind"], number> = { header: 36, issue: 44, "quick-add": 40 };

export function IssueList({
  issues,
  query,
  store,
  projectId,
  scope,
  collapsed,
  onToggleGroup,
  onNewIssue,
  peekId,
  onPeek,
  focusedId,
  order,
}: LayoutProps) {
  // A row that is not rendered cannot remember that it is expanded, so the list does.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [menuId, setMenuId] = useState<string | null>(null);
  const grouped = query.group !== "none";
  // Scrolling renders the list again with the same props: the items are made once per change of them.
  const items = useMemo(
    () =>
      flatten(groupIssues(query.group, query, store, issues, projectId), grouped, collapsed, expanded, store, scope),
    [issues, query, store, projectId, scope, grouped, collapsed, expanded],
  );
  // One pass for what follows from the items: the order of the issues, the width of their keys, and where the
  // items that are not issues sit, which is all that the heights depend on.
  const { ids, keyWidth, shape } = useMemo(() => {
    const ids: string[] = [];
    const others: number[] = [];
    // A project's longest key is its highest number's.
    const highest = new Map<string, Issue>();
    items.forEach((item, at) => {
      if (item.kind !== "issue") return others.push(at);
      ids.push(item.issue.id);
      const { projectId, number } = item.issue;
      if (number > (highest.get(projectId)?.number ?? 0)) highest.set(projectId, item.issue);
    });
    const keyWidth = Math.max(4, ...[...highest.values()].map((issue) => store.issues.key(issue).length));
    return { ids, keyWidth, shape: `${items.length}:${others.join()}` };
  }, [items, store]);
  useShownOrder(order, ids);

  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scroller.current,
    estimateSize: (index) => HEIGHTS[items[index].kind],
    // The virtualizer lays every item out again when this function changes, and only then: it changes with the
    // heights, not with every edit. Rows take their keys from the items, so the index does for the virtualizer.
    // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
    getItemKey: useCallback((index: number) => index, [shape]),
    overscan: OVERSCAN,
    // A row scrolled to must clear the header stuck at the top.
    scrollPaddingStart: grouped ? HEIGHTS.header : 0,
    // The header of the group at the top of the viewport stays rendered, to stick there.
    rangeExtractor: useCallback(
      (range: Range) => {
        const indexes = defaultRangeExtractor(range);
        const header = items[range.startIndex]?.header ?? -1;
        return header >= 0 && header < indexes[0] ? [header, ...indexes] : indexes;
      },
      [items],
    ),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a move of the focus scrolls, not a change of the list under it.
  useEffect(() => {
    const index = focusedId ? items.findIndex((item) => item.kind === "issue" && item.issue.id === focusedId) : -1;
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [focusedId]);

  const toggleExpanded = useCallback((issueId: string) => setExpanded((ids) => toggledSet(ids, issueId)), []);

  // Items stay in the page's flow, one section per group, so that a header sticks for as long as its group is on
  // screen. A spacer stands for the items left out: those above the first one, and those between a stuck header and
  // the rows near the viewport.
  const sections: { group: Group; before: ReactNode; children: ReactNode[] }[] = [];
  let end = 0;
  for (const virtual of virtualizer.getVirtualItems()) {
    const item = items[virtual.index];
    if (!item) continue;
    const spacer = virtual.start > end && (
      <div key={`spacer:${item.key}`} aria-hidden style={{ height: virtual.start - end }} />
    );
    let section = sections.at(-1);
    if (section?.group !== item.group) {
      section = { group: item.group, before: spacer, children: [] };
      sections.push(section);
    } else section.children.push(spacer);
    end = virtual.end;
    section.children.push(
      item.kind === "header" ? (
        <GroupHeader
          key={item.key}
          group={item.group}
          open={item.open}
          onToggle={() => onToggleGroup(item.group.key)}
          onNewIssue={onNewIssue}
        />
      ) : item.kind === "issue" ? (
        <IssueRow
          key={item.key}
          issue={item.issue}
          store={store}
          rev={store.issues.rev(item.issue.id)}
          properties={query.properties}
          keyWidth={keyWidth}
          depth={item.depth}
          expandable={item.expandable}
          expanded={item.expanded}
          onToggle={toggleExpanded}
          peeked={peekId === item.issue.id}
          menu={menuId === item.issue.id}
          focused={focusedId === item.issue.id}
          onPeek={onPeek}
        />
      ) : (
        <QuickAdd key={item.key} seed={item.seed} store={store} layout="list" groupName={item.group.name} />
      ),
    );
  }
  return (
    <IssuesContextMenu
      store={store}
      onIssue={setMenuId}
      render={<div ref={scroller} className="@container/list h-full overflow-y-auto" />}
    >
      <div style={{ height: virtualizer.getTotalSize() }}>
        {sections.map((section) => (
          <Fragment key={section.group.key}>
            {section.before}
            <section aria-label={section.group.name}>{section.children}</section>
          </Fragment>
        ))}
      </div>
    </IssuesContextMenu>
  );
}

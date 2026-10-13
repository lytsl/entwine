import { FILTER_KEYS, type IssueQuery } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { PlusIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PageHeader } from "../../../../components/page-header";
import { SELECTABLE_LAYOUTS } from "../../../../constants/issue-view";
import { PeekContext } from "../../../../contexts/peek";
import { SelectionContext } from "../../../../contexts/selection";
import { useIssueInContext } from "../../../../hooks/use-issue-in-context";
import { useIssuePage } from "../../../../hooks/use-issue-page";
import { useIssueSelection } from "../../../../hooks/use-issue-selection";
import { useShell } from "../../../../hooks/use-shell";
import { useShortcuts } from "../../../../hooks/use-shortcuts";
import { useStore } from "../../../../hooks/use-store";
import { useViewOnScreen } from "../../../../hooks/use-view-on-screen";
import { activeFilterCount } from "../../../../lib/issue-filters";
import { toggledSet } from "../../../../lib/toggle";
import { type Scope } from "../../../../store";
import type { LayoutProps, QueryChange } from "../../../../types/issue-view";
import type { IssueScope } from "../../../../types/shell";
import { IssuePeek } from "../issue/issue-peek";
import { BulkBar } from "./bulk-bar/bulk-bar";
import { AppliedFilters } from "./controls/applied-filters";
import { DisplayPanel } from "./controls/display-panel";
import { FiltersPanel } from "./controls/filters-panel";
import { LayoutSwitch } from "./controls/layout-switch";
import { SearchBox } from "./controls/search-box";
import { IssueLayout } from "./issue-layout";
import { IssuesEmpty } from "./issues-empty";

export function IssuesView({
  title,
  icon,
  crumbs,
  banner,
  inScope,
  paged = false,
  query,
  onChange,
  projectId,
  scope,
  actions,
  viewActions,
  peek,
  onPeek,
}: {
  title: ReactNode;
  icon?: ReactNode;
  crumbs?: ReactNode[];
  /** Shown under the header, such as the archived-project notice. */
  banner?: ReactNode;
  /** The issues the view looks at, before its filters. */
  inScope: Scope;
  /** The view is across projects: it holds the first issues of its order, and loads more when asked. */
  paged?: boolean;
  query: IssueQuery;
  onChange: QueryChange;
  projectId?: string;
  /** The cycle or module the view is limited to; `issues` are already its issues. */
  scope?: IssueScope;
  /** More header actions, before New issue. */
  actions?: ReactNode;
  /** Save, update or reset the view; shown in the applied-filters row. */
  viewActions?: ReactNode;
  peek?: string;
  onPeek(issueId: string | null): void;
}) {
  const store = useStore();
  const shell = useShell();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const page = useIssuePage(store, inScope, query, paged);
  /** The issue the keyboard is on; the peek's issue whenever one opens. */
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const order = useRef<readonly string[]>([]);
  useIssueInContext("focus", focusedId);
  const { selection, setSelected } = useIssueSelection(order);
  const { selected } = selection;
  const selectable = SELECTABLE_LAYOUTS.includes(query.layout);

  useEffect(() => {
    if (peek) setFocusedId(peek);
  }, [peek]);

  // The focus and the selection leave with their issues: filtered out, in a folded group, or on a layout that takes
  // no part. This runs after the layout's own effect, which states the order.
  useEffect(() => {
    if (!focusedId && !selected.size) return;
    const shownIds = new Set(order.current);
    if (focusedId && !shownIds.has(focusedId)) setFocusedId(null);
    if ([...selected].some((id) => !shownIds.has(id)))
      setSelected(new Set([...selected].filter((id) => shownIds.has(id))));
  });

  // The layout scrolls to the focused issue itself: it may have no element yet.
  const move = (delta: 1 | -1) => {
    const ids = order.current;
    if (ids.length === 0) return false;
    // The keys now point at the list. A control that still holds focus, such as the button a closed dialog gave it
    // back to, would take the Enter meant for the issue.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const at = focusedId ? ids.indexOf(focusedId) : -1;
    setFocusedId(ids[at < 0 ? (delta > 0 ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, at + delta))]);
  };
  useShortcuts({
    next: () => move(1),
    previous: () => move(-1),
    open: (event) => {
      // Enter on a button or link is that control's.
      if (!focusedId || (event.target instanceof Element && event.target.closest("button, a"))) return false;
      onPeek(focusedId);
    },
    dismiss: () => {
      if (peek) onPeek(null);
      else if (selected.size) setSelected(new Set());
      else if (focusedId) setFocusedId(null);
      else return false;
    },
    select: () => {
      if (!selectable || !focusedId) return false;
      selection.pick(focusedId, false);
    },
    selectAll: () => {
      if (!selectable) return false;
      setSelected(new Set(order.current));
    },
  });
  useViewOnScreen({ query, onChange, onPeek, scope });

  const newIssue = () => shell.openNewIssue(projectId ? { projectId } : {});
  const layoutProps: LayoutProps = {
    issues: page.issues,
    query,
    store,
    projectId,
    scope,
    collapsed,
    onToggleGroup: (key) => setCollapsed((keys) => toggledSet(keys, key)),
    onNewIssue: (seed) => shell.openNewIssue(seed),
    peekId: peek,
    onPeek,
    focusedId,
    order,
  };
  const filtered = activeFilterCount(query) > 0 || query.q.trim() !== "";
  // A project's groups stay on screen when it has no issues yet: they are where issues are added.
  const empty =
    page.issues.length === 0 && query.layout !== "calendar" && query.layout !== "timeline" && (filtered || !projectId);

  return (
    <PeekContext.Provider value={onPeek}>
      <SelectionContext.Provider value={selectable ? selection : null}>
        <PageHeader title={title} icon={icon} crumbs={crumbs} count={page.total}>
          <SearchBox value={query.q} onChange={(q) => onChange({ q })} />
          <LayoutSwitch value={query.layout} onChange={(layout) => onChange({ layout })} />
          <FiltersPanel query={query} onChange={onChange} store={store} projectId={projectId} />
          <DisplayPanel query={query} onChange={onChange} projectId={projectId} />
          {actions}
          <Button size="sm" className="h-7 text-body" onClick={newIssue}>
            <PlusIcon />
            New issue
          </Button>
        </PageHeader>
        {banner}
        <AppliedFilters query={query} onChange={onChange} store={store} projectId={projectId} actions={viewActions} />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {page.error ? (
            <p role="alert" className="p-8 text-muted-foreground">
              {page.error.message}
            </p>
          ) : page.loading && page.issues.length === 0 ? (
            <p role="status" className="p-8 text-muted-foreground">
              Loading issues…
            </p>
          ) : empty ? (
            <IssuesEmpty
              filtered={filtered}
              onClearFilters={() => onChange({ q: "", ...Object.fromEntries(FILTER_KEYS.map((key) => [key, []])) })}
              onNewIssue={newIssue}
            />
          ) : (
            <IssueLayout {...layoutProps} />
          )}
          {selected.size > 0 && (
            <BulkBar
              issues={[...selected].flatMap((id) => store.issues.get(id) ?? [])}
              store={store}
              onClear={() => setSelected(new Set())}
            />
          )}
          {peek && <IssuePeek issueId={peek} store={store} onClose={() => onPeek(null)} />}
        </div>
        {page.more && (
          <footer className="flex min-h-9 shrink-0 items-center gap-3 border-t px-4 py-1 text-caption text-muted-foreground">
            <span role="status">
              Showing the first {page.issues.length.toLocaleString()} of {page.total.toLocaleString()} issues
            </span>
            <Button variant="outline" size="xs" disabled={page.loading} onClick={page.more}>
              {page.loading ? "Loading…" : "Load more"}
            </Button>
          </footer>
        )}
      </SelectionContext.Provider>
    </PeekContext.Provider>
  );
}

import type { DisplayProperty } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import { ChevronsRightLeftIcon, PlusIcon } from "lucide-react";
import { type HTMLAttributes, useCallback, useEffect, useRef } from "react";
import { OVERSCAN } from "../../../../../constants/issue-view";
import type { Store } from "../../../../../store";
import { type Group, type LayoutProps } from "../../../../../types/issue-view";
import { QuickAdd } from "../quick-add";
import { IssueCard } from "./issue-card";

/** A card with a two-line title and a row of properties, until the card itself is measured. */
const CARD_HEIGHT = 122;
/** Between the cards of a column, as `gap-2` between the column's other children. */
const CARD_GAP = 8;

export function Column({
  group,
  store,
  properties,
  skip,
  over,
  dropTarget,
  dragging,
  onDragChange,
  onToggle,
  onNewIssue,
  peekId,
  onPeek,
  focusedId,
}: {
  group: Group;
  store: Store;
  properties: LayoutProps["query"]["properties"];
  skip?: DisplayProperty;
  over: boolean;
  dropTarget: HTMLAttributes<HTMLElement>;
  /** The issue being dragged, of any column. */
  dragging: string | null;
  onDragChange(issueId: string | null): void;
  onToggle(): void;
  onNewIssue: LayoutProps["onNewIssue"];
  peekId?: string;
  onPeek(issueId: string): void;
  focusedId: string | null;
}) {
  const { issues } = group;
  const column = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const dragIndex = dragging ? issues.findIndex((issue) => issue.id === dragging) : -1;
  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => CARD_HEIGHT,
    // Measured heights follow an issue when the order changes.
    getItemKey: useCallback((index: number) => issues[index].id, [issues]),
    gap: CARD_GAP,
    overscan: OVERSCAN / 2,
    // The card being dragged stays rendered while its column scrolls: without its element, the drag would never end.
    rangeExtractor: useCallback(
      (range: Range) => {
        const indexes = defaultRangeExtractor(range);
        return dragIndex < 0 || indexes.includes(dragIndex) ? indexes : [...indexes, dragIndex].sort((a, b) => a - b);
      },
      [dragIndex],
    ),
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a move of the focus scrolls, not a change of the column under it.
  useEffect(() => {
    const index = focusedId ? issues.findIndex((issue) => issue.id === focusedId) : -1;
    if (index < 0) return;
    virtualizer.scrollToIndex(index, { align: "auto" });
    column.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [focusedId]);

  return (
    <section
      ref={column}
      aria-label={group.name}
      className={cn(
        "group/column flex h-full w-[18.5rem] shrink-0 flex-col rounded-lg bg-muted/50 transition-colors",
        over && "bg-primary/10 ring-1 ring-primary/40",
      )}
      {...dropTarget}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 pr-1.5 pl-3">
        <span className="flex size-4 shrink-0 items-center justify-center">{group.icon}</span>
        <h2 className="truncate text-body font-medium">{group.name}</h2>
        <span className="text-caption text-muted-foreground tabular-nums">{issues.length}</span>
        <span className="ml-auto flex items-center hover-reveal transition-opacity group-hover/column:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={`Collapse ${group.name}`}
            title="Collapse"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={onToggle}
          >
            <ChevronsRightLeftIcon className="size-3.5" />
          </button>
          {group.seed && (
            <button
              type="button"
              aria-label={`New issue in ${group.name}`}
              title={`New issue in ${group.name}`}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => group.seed && onNewIssue(group.seed)}
            >
              <PlusIcon className="size-4" />
            </button>
          )}
        </span>
      </div>
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {issues.length > 0 && (
          <div className="relative shrink-0" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const issue = issues[item.index];
              return (
                issue && (
                  <div
                    key={item.key}
                    ref={virtualizer.measureElement}
                    data-index={item.index}
                    className="absolute inset-x-0 top-0"
                    style={{ transform: `translateY(${item.start}px)` }}
                  >
                    <IssueCard
                      issue={issue}
                      store={store}
                      properties={properties}
                      skip={skip}
                      peeked={peekId === issue.id}
                      focused={focusedId === issue.id}
                      dragging={dragging === issue.id}
                      onDragChange={(on) => onDragChange(on ? issue.id : null)}
                      onPeek={onPeek}
                    />
                  </div>
                )
              );
            })}
          </div>
        )}
        {group.seed && <QuickAdd seed={group.seed} store={store} layout="board" groupName={group.name} />}
      </div>
    </section>
  );
}

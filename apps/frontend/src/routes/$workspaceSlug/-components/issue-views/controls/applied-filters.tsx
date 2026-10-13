import { FILTER_KEYS, type IssueQuery } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { CheckOption } from "@entwine/ui/components/ui/check-option";
import { Popover, PopoverContent, PopoverTrigger } from "@entwine/ui/components/ui/popover";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { filterDefs, toggleFilter } from "../../../../../lib/issue-filters";
import type { Store } from "../../../../../store";
import { type FilterDef } from "../../../../../types/issue-view";

export function AppliedFilters({
  query,
  onChange,
  store,
  projectId,
  actions,
}: {
  query: IssueQuery;
  onChange(patch: Partial<IssueQuery>): void;
  store: Store;
  projectId?: string;
  /** The view's own actions; the row shows for them even with no filter. */
  actions?: ReactNode;
}) {
  const applied = filterDefs(store, projectId).filter((def) => query[def.key].length > 0);
  if (!applied.length && !actions) return null;
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 border-b px-3 py-1.5">
      <div role="group" className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" aria-label="Applied filters">
        {applied.map((def) => (
          <FilterChip key={def.key} def={def} query={query} onChange={onChange} />
        ))}
        {applied.length > 0 && (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => onChange(Object.fromEntries(FILTER_KEYS.map((key) => [key, []])))}
          >
            Clear all
          </Button>
        )}
      </div>
      {actions && (
        <div className={applied.length > 0 ? "flex items-center gap-1.5 border-l pl-3" : "flex items-center gap-1.5"}>
          {actions}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  def,
  query,
  onChange,
}: {
  def: FilterDef;
  query: IssueQuery;
  onChange(patch: Partial<IssueQuery>): void;
}) {
  const selected = query[def.key] as string[];
  const chosen = def.options.filter((o) => selected.includes(o.value));
  // A value the options no longer offer (a deleted label, say) still filters, and still reads as a count.
  const names = chosen.length === selected.length ? chosen.map((o) => o.label).join(", ") : `${selected.length} values`;
  return (
    <div
      role="group"
      aria-label={`${def.title} filter`}
      className="inline-flex h-7 max-w-md items-stretch overflow-hidden rounded-md border bg-background text-caption shadow-xs"
    >
      <span className="flex items-center px-2 font-medium">{def.title}</span>
      <span className="flex items-center border-l px-2 text-muted-foreground">
        {selected.length > 1 ? "is any of" : "is"}
      </span>
      <Popover>
        <PopoverTrigger className="flex min-w-0 items-center gap-1.5 border-l px-2 hover:bg-accent data-popup-open:bg-accent">
          <span className="flex -space-x-1 [&>*]:rounded-full [&>*]:bg-background">
            {chosen.slice(0, 3).map((o) => (
              <span key={o.value} className="flex size-4 items-center justify-center">
                {o.icon}
              </span>
            ))}
          </span>
          <span className="truncate">{names}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 gap-0 p-1.5" aria-label={`${def.title} values`}>
          {def.options.map((option) => (
            <CheckOption
              key={option.value}
              label={option.label}
              icon={option.icon}
              checked={selected.includes(option.value)}
              onToggle={() => onChange(toggleFilter(query, def.key, option.value))}
            />
          ))}
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={`Remove ${def.title.toLowerCase()} filter`}
        className="flex w-7 shrink-0 items-center justify-center border-l text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => onChange({ [def.key]: [] })}
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

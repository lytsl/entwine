import type { IssueQuery } from "@entwine/shared";
import { CheckOption } from "@entwine/ui/components/ui/check-option";
import { Popover, PopoverContent } from "@entwine/ui/components/ui/popover";
import { SearchField } from "@entwine/ui/components/ui/search-field";
import { cn } from "@entwine/ui/lib/utils";
import { ChevronDownIcon, ListFilterIcon } from "lucide-react";
import { useState } from "react";
import { activeFilterCount, filterDefs, toggleFilter } from "../../../../../lib/issue-filters";
import { toggledSet } from "../../../../../lib/toggle";
import type { Store } from "../../../../../store";
import { type QueryChange } from "../../../../../types/issue-view";
import { PanelButton } from "./panel-button";

export function FiltersPanel({
  query,
  onChange,
  store,
  projectId,
}: {
  query: IssueQuery;
  onChange: QueryChange;
  store: Store;
  projectId?: string;
}) {
  const [search, setSearch] = useState("");
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const text = search.trim().toLowerCase();
  return (
    <Popover onOpenChange={(open) => !open && setSearch("")}>
      <PanelButton icon={<ListFilterIcon />} label="Filters" active={activeFilterCount(query) > 0} />
      <PopoverContent align="end" className="w-72 gap-0 p-0" aria-label="Filters">
        <div className="border-b p-2">
          <SearchField
            className="h-8 w-auto gap-2 border-0 bg-muted/60"
            aria-label="Search filters"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex max-h-[26rem] flex-col gap-1 overflow-y-auto p-1.5">
          {filterDefs(store, projectId).map((def) => {
            const options = def.options.filter((o) => !text || o.label.toLowerCase().includes(text));
            if (!options.length) return null;
            const selected = query[def.key] as string[];
            const open = !!text || !folded.has(def.key);
            return (
              <div key={def.key} role="group" aria-label={def.title}>
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-caption font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setFolded((keys) => toggledSet(keys, def.key))}
                >
                  {def.title}
                  {selected.length > 0 && (
                    <span className="rounded-full bg-primary/15 px-1.5 text-micro text-primary-text">
                      {selected.length}
                    </span>
                  )}
                  <ChevronDownIcon className={cn("ml-auto size-3.5 transition-transform", !open && "-rotate-90")} />
                </button>
                {open &&
                  options.map((option) => (
                    <CheckOption
                      key={option.value}
                      label={option.label}
                      icon={option.icon}
                      checked={selected.includes(option.value)}
                      onToggle={() => onChange(toggleFilter(query, def.key, option.value))}
                    />
                  ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

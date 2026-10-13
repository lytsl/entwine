import { DISPLAY_PROPERTIES, type DisplayProperty, GROUP_BY, type IssueQuery, ORDER_BY } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { Popover, PopoverContent } from "@entwine/ui/components/ui/popover";
import { Separator } from "@entwine/ui/components/ui/separator";
import { Switch } from "@entwine/ui/components/ui/switch";
import { cn } from "@entwine/ui/lib/utils";
import { ChevronDownIcon, Settings2Icon } from "lucide-react";
import { GROUP_BY_LABELS, ORDER_BY_LABELS, PROPERTY_LABELS } from "../../../../../constants/issue-view";
import { toggledSet } from "../../../../../lib/toggle";
import { type QueryChange } from "../../../../../types/issue-view";
import { PanelButton } from "./panel-button";

function OptionRow<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange(value: T): void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-body text-muted-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-7 min-w-32 justify-between px-2 text-body"
              aria-label={label}
            />
          }
        >
          {labels[value]}
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuRadioGroup value={value} onValueChange={(next: string) => onChange(next as T)}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {labels[option]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-body text-muted-foreground">{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function DisplayPanel({
  query,
  onChange,
  projectId,
}: {
  query: IssueQuery;
  onChange: QueryChange;
  projectId?: string;
}) {
  const groupings = GROUP_BY.filter((g) => !(projectId && g === "project"));
  const toggleProperty = (property: DisplayProperty) => {
    const on = toggledSet(new Set(query.properties), property);
    // Kept in the canonical order, so that "all of them" matches the default and leaves the URL.
    onChange({ properties: DISPLAY_PROPERTIES.filter((p) => on.has(p)) });
  };
  const grouped = query.layout === "list" || query.layout === "board";
  return (
    <Popover>
      <PanelButton icon={<Settings2Icon />} label="Display" />
      <PopoverContent align="end" className="w-80 gap-0 p-0 py-1.5" aria-label="Display">
        {grouped && (
          <OptionRow
            label="Grouping"
            value={query.group}
            options={groupings}
            labels={GROUP_BY_LABELS}
            onChange={(group) => onChange({ group })}
          />
        )}
        {query.layout !== "calendar" && (
          <OptionRow
            label="Ordering"
            value={query.order}
            options={ORDER_BY}
            labels={ORDER_BY_LABELS}
            onChange={(order) => onChange({ order })}
          />
        )}
        <Separator className="my-1.5" />
        <SwitchRow
          label="Show sub-issues"
          checked={query.subIssues}
          onChange={(subIssues) => onChange({ subIssues })}
        />
        {grouped && (
          <SwitchRow
            label="Show empty groups"
            checked={query.emptyGroups}
            onChange={(emptyGroups) => onChange({ emptyGroups })}
          />
        )}
        <Separator className="my-1.5" />
        <div className="px-3 pt-1 pb-1.5" role="group" aria-label="Display properties">
          <p className="mb-2 text-caption font-medium text-muted-foreground">Display properties</p>
          <div className="flex flex-wrap gap-1.5">
            {DISPLAY_PROPERTIES.map((property) => {
              const on = query.properties.includes(property);
              return (
                <button
                  key={property}
                  type="button"
                  aria-pressed={on}
                  className={cn(
                    "h-6 rounded-md border px-2 text-caption transition-colors",
                    on
                      ? "border-primary/40 bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  onClick={() => toggleProperty(property)}
                >
                  {PROPERTY_LABELS[property]}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

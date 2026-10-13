import { mergeProps } from "@base-ui/react/merge-props";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@entwine/ui/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@entwine/ui/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@entwine/ui/components/ui/tooltip";
import { cn } from "@entwine/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps, type MouseEvent, type ReactNode, useState } from "react";

/** A pill in rows, cards and forms, a field in an issue's sidebar, a cell in the spreadsheet, or an icon alone. */
const propertyTriggerVariants = cva(
  "inline-flex min-w-0 shrink-0 items-center whitespace-nowrap outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60 data-popup-open:bg-accent [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      face: {
        pill: "h-6 max-w-44 gap-1 rounded-md border border-border px-1.5 text-caption text-muted-foreground hover:bg-accent hover:text-foreground data-popup-open:text-foreground",
        field:
          "h-8 w-full gap-2 rounded-md px-2 text-left text-body text-foreground hover:bg-accent [&_svg:not([class*='size-'])]:size-4",
        cell: "h-full w-full gap-1.5 px-2.5 text-left text-body text-foreground hover:bg-accent",
        icon: "size-6 justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: { face: "pill" },
  },
);

export type PropertyFace = NonNullable<VariantProps<typeof propertyTriggerVariants>["face"]>;

/** Keep the trigger mounted when its tooltip disappears, so an open popup retains its anchor. */
function WithTooltip({ tooltip, trigger }: { tooltip?: ReactNode; trigger: ReactNode }) {
  return (
    <Tooltip disabled={!tooltip}>
      <TooltipTrigger render={trigger as React.ReactElement} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Rows show these by the hundred, so the popover is mounted lazily: until its first click the trigger is a plain
 * button, which mounts the popover and opens it in one action. `children` is the popup, a `PopoverContent`.
 */
function PropertyPopover({
  open,
  onOpenChange,
  label,
  tooltip,
  className,
  disabled,
  trigger,
  triggerProps,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The trigger's accessible name, such as "Priority: High". */
  label: string;
  /** Shown while the popup is closed; the browser's own tooltip until the popover is mounted. */
  tooltip?: string;
  className?: string;
  disabled?: boolean;
  trigger: ReactNode;
  /** More for the trigger, such as what a toolbar gives its buttons. */
  triggerProps?: ComponentProps<"button">;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  // Rows and cards are links or drag handles: a click on a control is not a click on them.
  const keep = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  if (!mounted)
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={false}
        aria-label={label}
        title={tooltip}
        disabled={disabled}
        className={className}
        {...mergeProps<"button">(triggerProps, {
          onClick: (event) => {
            keep(event);
            setMounted(true);
            onOpenChange(true);
          },
        })}
      >
        {trigger}
      </button>
    );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <WithTooltip
        tooltip={open ? undefined : tooltip}
        trigger={
          <PopoverTrigger
            disabled={disabled}
            aria-label={label}
            className={className}
            {...mergeProps<"button">(triggerProps, { onClick: keep })}
          >
            {trigger}
          </PopoverTrigger>
        }
      />
      {children}
    </Popover>
  );
}

function PropertyPlaceholder({ children }: { children: ReactNode }) {
  return <span className="truncate text-muted-foreground">{children}</span>;
}

export interface PropertyOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Shown at the end of the row, such as a project identifier. */
  hint?: ReactNode;
  /** More words the search matches, besides the label. */
  keywords?: string[];
}

interface PropertyOptionsProps<T> {
  /** A function is called when the popup opens, which spares a row of controls working the choices out. */
  options: PropertyOption<T>[] | (() => PropertyOption<T>[]);
  isSelected(value: T): boolean;
  onSelect(value: T): void;
  searchPlaceholder?: string;
  align?: "start" | "end";
  width?: number;
  /** Rows after the options, given the search text and a way to close: "Create label", say. */
  extra?(search: string, close: () => void): ReactNode;
  emptyText?: string;
}

/** A component of its own, so that nothing of the popup is made before it is shown. */
function PropertyOptions<T extends string | number | null>({
  options,
  isSelected,
  onSelect,
  searchPlaceholder,
  align = "start",
  width = 240,
  extra,
  emptyText = "No matches",
  search,
  onSearch,
  close,
}: PropertyOptionsProps<T> & { search: string; onSearch(search: string): void; close(): void }) {
  const word = search.trim().toLowerCase();
  const found = (typeof options === "function" ? options() : options).filter((option) =>
    [option.label, ...(option.keywords ?? [])].some((text) => text.toLowerCase().includes(word)),
  );
  return (
    <PopoverContent className="gap-0 p-0" style={{ width }} align={align} onClick={(event) => event.stopPropagation()}>
      <Command className="rounded-md! bg-transparent">
        <CommandInput placeholder={searchPlaceholder ?? "Search…"} value={search} onValueChange={onSearch} />
        <CommandList>
          <CommandEmpty className="py-4 text-caption text-muted-foreground">{emptyText}</CommandEmpty>
          <CommandGroup>
            {found.map((option) => (
              <CommandItem
                key={String(option.value)}
                data-checked={isSelected(option.value)}
                className="text-body"
                onSelect={() => onSelect(option.value)}
              >
                {option.icon && (
                  <span aria-hidden className="flex w-4 shrink-0 justify-center">
                    {option.icon}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && <span className="text-caption text-muted-foreground">{option.hint}</span>}
              </CommandItem>
            ))}
            {extra?.(search, close)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );
}

/** Picks one value, or toggles several, from a searchable list: the one control behind every issue property. */
function PropertySelect<T extends string | number | null>({
  label,
  onSelect,
  children,
  face = "pill",
  tooltip,
  multiple = false,
  disabled = false,
  className,
  ...popup
}: PropertyOptionsProps<T> & {
  /** The trigger's accessible name, such as "Priority: High". */
  label: string;
  children: ReactNode;
  face?: PropertyFace;
  tooltip?: string;
  /** Stay open after a choice, to toggle several values. */
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const close = () => setOpen(false);
  return (
    <PropertyPopover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      label={label}
      tooltip={tooltip}
      className={cn(propertyTriggerVariants({ face }), className)}
      disabled={disabled}
      trigger={children}
    >
      <PropertyOptions
        {...popup}
        onSelect={(value) => {
          onSelect(value);
          if (!multiple) close();
        }}
        search={search}
        onSearch={setSearch}
        close={close}
      />
    </PropertyPopover>
  );
}

export { PropertyPlaceholder, PropertyPopover, PropertySelect, propertyTriggerVariants, WithTooltip };

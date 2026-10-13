import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import type { ReactNode } from "react";

export interface SelectMenuItem<T> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

/** Base UI's radio group keys on strings, so values go over as `String(value)` and come back through `items`. */
function SelectMenu<T extends string | number | null>({
  trigger,
  items,
  value,
  onSelect,
  align = "left",
  width = 224,
  title,
}: {
  trigger: ReactNode;
  items: SelectMenuItem<T>[];
  value: T;
  onSelect: (value: T) => void;
  align?: "left" | "right";
  width?: number;
  title?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 text-[13px] text-muted-foreground transition hover:border-border hover:bg-accent hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align === "right" ? "end" : "start"}
        className="w-auto"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Base UI's label is a group label, and throws outside a group. */}
        {title && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="uppercase tracking-wide">{title}</DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        <DropdownMenuRadioGroup
          value={String(value)}
          onValueChange={(next) => {
            const item = items.find((i) => String(i.value) === next);
            if (item) onSelect(item.value);
          }}
        >
          {items.map((item) => (
            <DropdownMenuRadioItem key={String(item.value)} value={String(item.value)} closeOnClick>
              {item.icon && <span className="flex w-4 justify-center">{item.icon}</span>}
              <span className="flex-1 truncate">{item.label}</span>
              {item.hint && <DropdownMenuShortcut className="mr-1">{item.hint}</DropdownMenuShortcut>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { SelectMenu };

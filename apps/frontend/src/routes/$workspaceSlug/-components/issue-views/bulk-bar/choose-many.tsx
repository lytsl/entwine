import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import type { PropertyOption } from "@entwine/ui/components/ui/property-select";
import { ToolbarButton } from "@entwine/ui/components/ui/toolbar";
import type { ReactNode } from "react";

const trigger = (
  <ToolbarButton render={<Button variant="ghost" size="sm" className="h-7 text-body data-popup-open:bg-accent" />} />
);

/** Checked when every issue has it; choosing adds it to all or removes it from all. */
export function ChooseMany({
  label,
  icon,
  options,
  has,
  onToggle,
}: {
  label: string;
  icon: ReactNode;
  options: PropertyOption<string>[];
  has(value: string): boolean;
  onToggle(value: string): void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>
        {icon}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="max-h-80 w-52">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={has(option.value)}
            onCheckedChange={() => onToggle(option.value)}
          >
            <span aria-hidden className="flex w-4 shrink-0 justify-center">
              {option.icon}
            </span>
            <span className="truncate">{option.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

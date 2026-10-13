import { Button } from "@entwine/ui/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@entwine/ui/components/ui/dropdown-menu";
import { OptionRadios } from "@entwine/ui/components/ui/option-radios";
import type { PropertyOption } from "@entwine/ui/components/ui/property-select";
import { ToolbarButton } from "@entwine/ui/components/ui/toolbar";
import type { ReactNode } from "react";

const trigger = (
  <ToolbarButton render={<Button variant="ghost" size="sm" className="h-7 text-body data-popup-open:bg-accent" />} />
);

export function Choose<T extends string | number | null>({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  options: PropertyOption<T>[];
  value: T | undefined;
  onChange(value: T): void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>
        {icon}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="max-h-80 w-52">
        <OptionRadios options={options} value={value} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

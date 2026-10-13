import { CommandItem } from "@entwine/ui/components/ui/command";
import type { ReactNode } from "react";

export function PaletteItem({
  icon,
  children,
  hint,
  checked,
  onSelect,
}: {
  icon?: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  checked?: boolean;
  onSelect(): void;
}) {
  return (
    <CommandItem data-checked={checked} className="text-body" onSelect={onSelect}>
      {icon && (
        <span aria-hidden className="flex w-4 shrink-0 justify-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint}
    </CommandItem>
  );
}

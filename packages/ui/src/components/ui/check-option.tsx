import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

function CheckOption({
  label,
  icon,
  checked,
  onToggle,
}: {
  label: string;
  icon?: ReactNode;
  checked: boolean;
  onToggle(): void;
}) {
  return (
    <CheckboxPrimitive.Root
      nativeButton
      render={<button type="button" />}
      checked={checked}
      onCheckedChange={onToggle}
      aria-label={label}
      className="group/check-option flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
    >
      <span className="flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors group-data-checked/check-option:border-primary group-data-checked/check-option:bg-primary group-data-checked/check-option:text-primary-foreground">
        <CheckboxPrimitive.Indicator>
          <CheckIcon className="size-2.5" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </span>
      {icon && <span className="flex w-4 shrink-0 justify-center">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </CheckboxPrimitive.Root>
  );
}

export { CheckOption };

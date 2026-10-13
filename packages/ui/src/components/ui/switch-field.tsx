import { Switch } from "@entwine/ui/components/ui/switch";
import { type ReactNode, useId } from "react";

/** A switch with its label and what it does, all of which toggle it. */
export function SwitchField({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: ReactNode;
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}) {
  const describedBy = useId();
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 has-data-disabled:cursor-default">
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-medium">{label}</span>
        <span id={describedBy} className="text-body text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
        aria-describedby={describedBy}
      />
    </label>
  );
}

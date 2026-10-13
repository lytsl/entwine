import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@entwine/ui/components/ui/dropdown-menu";
import type { PropertyOption } from "@entwine/ui/components/ui/property-select";

/** `undefined` checks none, as for several items whose values differ. Choosing one closes the menu. */
function OptionRadios<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: PropertyOption<T>[];
  value: T | undefined;
  onChange(value: T): void;
}) {
  // Radio values are strings; null ("Unassigned", "No estimate") is the empty one.
  const keyOf = (v: T | undefined) => (v === undefined ? undefined : v === null ? "" : String(v));
  return (
    <DropdownMenuRadioGroup
      value={keyOf(value) ?? null}
      onValueChange={(next) => {
        const option = options.find((o) => keyOf(o.value) === next);
        if (option && option.value !== value) onChange(option.value);
      }}
    >
      {options.map((option) => (
        <DropdownMenuRadioItem key={keyOf(option.value)} value={keyOf(option.value)} closeOnClick>
          <span aria-hidden className="flex w-4 shrink-0 justify-center">
            {option.icon}
          </span>
          <span className="truncate">{option.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

export { OptionRadios };

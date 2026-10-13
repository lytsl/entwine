import { STATE_GROUPS, type StateGroup } from "@entwine/shared";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";
import { GROUP_LABELS } from "../../../../../../constants/state";

export function StateGroupPicker({
  value,
  onChange,
  color,
}: {
  value: StateGroup;
  onChange(group: StateGroup): void;
  color: string;
}) {
  return (
    <PropertySelect<StateGroup>
      label={`Group: ${GROUP_LABELS[value]}`}
      face="pill"
      className="h-8"
      searchPlaceholder="Group…"
      options={STATE_GROUPS.map((g) => ({
        value: g,
        label: GROUP_LABELS[g],
        icon: <StateIcon type={g} color={color} />,
      }))}
      isSelected={(g) => g === value}
      onSelect={onChange}
    >
      <StateIcon type={value} color={color} className="size-3.5!" />
      {GROUP_LABELS[value]}
    </PropertySelect>
  );
}

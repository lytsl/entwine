import { MODULE_STATUSES, type ModuleStatus } from "@entwine/shared";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";
import { textColor } from "@entwine/ui/lib/utils";
import { ModuleStatusIcon } from "../../../../components/module-status-icon";
import { MODULE_STATUS_LABELS } from "../../../../constants/module";

/** The pill face sits in cards and headers, the bordered one in forms. */
export function ModuleStatusSelect({
  value,
  onChange,
  disabled,
  bordered,
}: {
  value: ModuleStatus;
  onChange(status: ModuleStatus): void;
  disabled?: boolean;
  bordered?: boolean;
}) {
  const { label, color } = MODULE_STATUS_LABELS[value];
  return (
    <PropertySelect<ModuleStatus>
      label={`Status: ${label}`}
      face={bordered ? "field" : "pill"}
      disabled={disabled}
      className={bordered ? "h-9 border" : "border-transparent font-medium"}
      searchPlaceholder="Set status…"
      options={MODULE_STATUSES.map((s) => ({
        value: s,
        label: MODULE_STATUS_LABELS[s].label,
        icon: <ModuleStatusIcon status={s} className="size-3.5" />,
      }))}
      isSelected={(s) => s === value}
      onSelect={(s) => s !== value && onChange(s)}
    >
      <ModuleStatusIcon status={value} className="size-3.5" />
      <span style={bordered ? undefined : { color: textColor(color) }}>{label}</span>
    </PropertySelect>
  );
}

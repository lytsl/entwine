import { ROLE_LABELS, type Role } from "@entwine/shared";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";

export function RolePicker({
  value,
  onChange,
  label,
  roles,
}: {
  value: Role;
  onChange(role: Role): void;
  label: string;
  roles: Role[];
}) {
  return (
    <PropertySelect<Role>
      label={label}
      face="pill"
      className="h-7"
      align="end"
      width={180}
      searchPlaceholder="Role…"
      options={roles.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
      isSelected={(role) => role === value}
      onSelect={onChange}
    >
      {ROLE_LABELS[value]}
    </PropertySelect>
  );
}

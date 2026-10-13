import { PRIORITY_LABELS, type Priority } from "@entwine/shared";
import { PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { type PropertyFace, PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { cn } from "@entwine/ui/lib/utils";
import { priorityOptions } from "../../../../lib/issue-options";

export function PriorityPicker({
  value,
  onChange,
  face = "pill",
  showName = face === "field" || face === "cell",
}: {
  value: Priority;
  onChange(priority: Priority): void;
  face?: PropertyFace;
  showName?: boolean;
}) {
  return (
    <PropertySelect<Priority>
      label={`Priority: ${PRIORITY_LABELS[value]}`}
      tooltip={showName ? undefined : `Priority: ${PRIORITY_LABELS[value]}`}
      face={face}
      searchPlaceholder="Set priority…"
      options={() => priorityOptions()}
      isSelected={(p) => p === value}
      onSelect={(p) => p !== value && onChange(p)}
      // An urgent pill takes its colour, so it stands out in a row of grey pills.
      className={cn(face === "pill" && value === "urgent" && "border-orange-500/40 bg-orange-500/10")}
    >
      <PriorityIcon priority={value} className="size-3.5! text-muted-foreground" />
      {showName &&
        (value === "none" && face !== "pill" ? (
          <PropertyPlaceholder>No priority</PropertyPlaceholder>
        ) : (
          PRIORITY_LABELS[value]
        ))}
    </PropertySelect>
  );
}

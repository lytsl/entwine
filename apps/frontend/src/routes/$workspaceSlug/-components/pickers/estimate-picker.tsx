import { type PropertyFace, PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { TriangleIcon } from "lucide-react";
import { estimateLabel, estimateOptions } from "../../../../lib/issue-options";

export function EstimatePicker({
  value,
  onChange,
  face = "pill",
}: {
  value: number | null;
  onChange(estimate: number | null): void;
  face?: PropertyFace;
}) {
  return (
    <PropertySelect<number | null>
      label={`Estimate: ${estimateLabel(value)}`}
      tooltip={face === "pill" ? `Estimate: ${estimateLabel(value)}` : undefined}
      face={face}
      searchPlaceholder="Estimate…"
      options={() => estimateOptions()}
      isSelected={(e) => e === value}
      onSelect={(e) => e !== value && onChange(e)}
    >
      <TriangleIcon className="text-muted-foreground" />
      {face === "pill" ? (
        (value ?? "Estimate")
      ) : value === null ? (
        <PropertyPlaceholder>No estimate</PropertyPlaceholder>
      ) : (
        estimateLabel(value)
      )}
    </PropertySelect>
  );
}

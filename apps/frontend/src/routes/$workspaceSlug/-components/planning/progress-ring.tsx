import type { Progress } from "@entwine/shared";
import { CircularProgress } from "@entwine/ui/components/ui/circular-progress";
import { CheckIcon } from "lucide-react";
import { wholePercent } from "../../../../lib/plan";

export function ProgressRing({ value, size = 18 }: { value: Progress; size?: number }) {
  const percent = wholePercent(value);
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground tabular-nums">
      <CircularProgress value={value.percent} size={size} label={`${percent}% done`} />
      {percent === 100 ? <CheckIcon className="size-3.5 text-success" /> : `${percent}%`}
    </span>
  );
}

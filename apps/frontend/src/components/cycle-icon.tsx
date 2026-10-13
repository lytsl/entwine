import type { CyclePhase } from "@entwine/shared";
import { cn } from "@entwine/ui/lib/utils";
import { IterationCcwIcon } from "lucide-react";
import { PHASE_LABELS } from "../constants/cycle";

export function CycleIcon({ phase, className }: { phase?: CyclePhase; className?: string }) {
  return (
    <IterationCcwIcon
      aria-hidden
      className={cn("size-4 shrink-0", !phase && "text-muted-foreground", className)}
      style={phase && { color: PHASE_LABELS[phase].color }}
    />
  );
}

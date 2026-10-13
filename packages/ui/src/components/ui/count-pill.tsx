import { Tooltip, TooltipContent, TooltipTrigger } from "@entwine/ui/components/ui/tooltip";
import type { ReactNode } from "react";

function CountPill({ icon, count, tooltip }: { icon: ReactNode; count: ReactNode; tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-caption text-muted-foreground [&_svg]:size-3.5" />
        }
      >
        {icon}
        {count}
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { CountPill };

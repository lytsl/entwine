import { Button } from "@entwine/ui/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@entwine/ui/components/ui/collapsible";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";

export function WidgetSection({
  title,
  extra,
  onAdd,
  addLabel,
  children,
}: {
  title: string;
  extra?: ReactNode;
  onAdd?(): void;
  addLabel?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible defaultOpen render={<section aria-label={title} className="flex flex-col gap-1" />}>
      <div className="group/section flex h-8 items-center gap-2">
        <CollapsibleTrigger className="-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-body font-medium hover:bg-accent [&[data-panel-open]>svg]:rotate-90">
          <ChevronRightIcon className="size-3.5 text-muted-foreground transition-transform" />
          {title}
        </CollapsibleTrigger>
        {extra}
        {onAdd && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto"
            aria-label={addLabel}
            title={addLabel}
            onClick={onAdd}
          >
            <PlusIcon />
          </Button>
        )}
      </div>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

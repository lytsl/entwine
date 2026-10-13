import { cn } from "@entwine/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

export function PlansSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: ReactNode;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-label={title}>
      <h2 className="sticky top-0 z-[2] border-b bg-muted/60 backdrop-blur">
        <button
          type="button"
          aria-expanded={open}
          className="flex h-9 w-full items-center gap-2 px-4 text-left text-body hover:bg-accent/40"
          onClick={() => setOpen(!open)}
        >
          <ChevronRightIcon
            className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")}
          />
          {icon}
          <span className="font-medium">{title}</span>
          <span className="text-caption text-muted-foreground tabular-nums">{count}</span>
        </button>
      </h2>
      {open && children}
    </section>
  );
}

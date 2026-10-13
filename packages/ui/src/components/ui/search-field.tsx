import { cn } from "@entwine/ui/lib/utils";
import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

/** `className` sizes and colours the box, `children` follow the input; everything else goes to the input. */
function SearchField({ className, children, ...props }: ComponentProps<"input">) {
  return (
    <div
      className={cn(
        "flex h-7 w-52 items-center gap-1.5 rounded-md border bg-background px-2 focus-within:ring-2 focus-within:ring-ring/40",
        className,
      )}
    >
      <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <input
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground max-md:text-base"
        {...props}
      />
      {children}
    </div>
  );
}

export { SearchField };

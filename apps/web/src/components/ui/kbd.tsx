import type React from "react";
import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"pointer-events-none inline-block min-w-4.5 select-none rounded-sm bg-muted in-data-[slot=tooltip-content]:bg-transparent p-0.5 text-center font-normal font-sans in-data-[slot=tooltip-content]:text-[oklch(0.6976_0.0051_271.23)] text-2xs text-muted-foreground [&_svg:not([class*='size-'])]:size-3",
				"border border-[oklch(0.3526_0.0126_269.8)] leading-[110%]",
				className,
			)}
			{...props}
		/>
	);
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<kbd
			data-slot="kbd-group"
			className={cn("inline-flex items-center gap-0.75", className)}
			{...props}
		/>
	);
}

export { Kbd, KbdGroup };

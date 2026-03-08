import { Input as InputPrimitive } from "@base-ui/react/input";
import type { MergeType } from "@entwine/utility/types";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const inputVariants = cva(
	"w-full min-w-0 rounded-md border border-input bg-transparent text-base outline-none transition-colors file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:disabled:bg-input/80",
	{
		variants: {
			size: {
				default: "h-8 px-2.5 py-1 file:h-6",
				xl: "h-12 p-3 file:h-9",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
);

function Input({
	className,
	type,
	size,
	...props
}: MergeType<
	React.ComponentProps<"input">,
	VariantProps<typeof inputVariants>
>) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(inputVariants({ size, className }))}
			{...props}
		/>
	);
}

export { Input };

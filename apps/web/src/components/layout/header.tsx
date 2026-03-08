import { cn } from "@/lib/utils";

export function Header({
	children,
	className,
	...props
}: React.ComponentProps<"header"> & {}) {
	return (
		<header className={cn("flex w-full flex-col", className)} {...props}>
			{children}
		</header>
	);
}

export function HeaderItem({
	children,
	className,
	...props
}: React.ComponentProps<"div"> & {}) {
	return (
		<div
			className={cn(
				"flex h-10 w-full border-b border-b-[oklch(0.2655_0.0094_269.8)] ps-6 pe-4",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

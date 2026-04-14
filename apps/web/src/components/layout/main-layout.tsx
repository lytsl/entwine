import React from "react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
	children: React.ReactNode;
	header?: React.ReactNode;
	headersNumber?: 1 | 2;
}

const isEmptyHeader = (header: React.ReactNode | undefined): boolean => {
	if (!header) return true;

	if (React.isValidElement(header) && header.type === React.Fragment) {
		const props = header.props as { children?: React.ReactNode };

		if (!props.children) return true;

		if (Array.isArray(props.children) && props.children.length === 0) {
			return true;
		}
	}

	return false;
};

export default function MainLayout({
	children,
	header,
	headersNumber = 2,
}: MainLayoutProps) {
	const height = {
		1: "h-[calc(100svh-40px)] lg:h-[calc(100svh-56px)]",
		2: "h-[calc(100svh-80px)] lg:h-[calc(100svh-96px)]",
	};
	return (
		<div className="h-full w-full overflow-hidden lg:p-2">
			<div className="flex h-full w-full flex-col items-center justify-start overflow-hidden bg-container lg:rounded-md lg:border">
				{header}
				<div
					className={cn(
						"w-full overflow-auto",
						isEmptyHeader(header)
							? "h-full"
							: height[headersNumber as keyof typeof height],
					)}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

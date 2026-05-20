"use client";

import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FC, useRef } from "react";
import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { type Issue, sortIssuesByPriority } from "@/mock-data/issues";
import { type IssueStatus, IssueStatusTypeMap } from "@/mock-data/status";
import { useCreateIssueStore } from "@/store/create-issue-store";
import { useIssuesStore } from "@/store/issues-store";
import { useViewStore } from "@/store/view-store";
import { Button } from "../ui/button";
import { IssueDragType, IssueGrid } from "./issue-grid";
import { IssueLine } from "./issue-line";

interface GroupIssuesProps {
	issueStatus: IssueStatus;
	data: { issue: Issue; issueStatus: IssueStatus }[];
	count: number;
}

export function GroupIssues({ issueStatus, data, count }: GroupIssuesProps) {
	const { viewType } = useViewStore();
	const isViewTypeGrid = viewType === "grid";

	const { openModal } = useCreateIssueStore();

	const statusTheme = IssueStatusTypeMap[issueStatus.type];

	return (
		<div
			className={cn(
				"bg-conainer",
				isViewTypeGrid
					? "flex h-full w-[348px] flex-shrink-0 flex-col overflow-hidden rounded-md"
					: "",
			)}
		>
			<div
				className={cn(
					"sticky top-0 z-10 w-full bg-container",
					isViewTypeGrid ? "h-[50px] rounded-t-md" : "h-10",
				)}
			>
				<div
					className={cn(
						"flex h-full w-full items-center justify-between",
						isViewTypeGrid ? "px-3" : "px-6",
					)}
					style={{
						backgroundColor: isViewTypeGrid
							? `${statusTheme.color}10`
							: `${statusTheme.color}08`,
					}}
				>
					<div className="flex items-center gap-2">
						<statusTheme.icon />
						<span className="font-medium text-sm">{issueStatus.name}</span>
						<span className="text-muted-foreground text-sm">{count}</span>
					</div>

					<Button
						className="size-6"
						size="icon"
						variant="ghost"
						onClick={(e) => {
							e.stopPropagation();
							openModal(issueStatus);
						}}
					>
						<Plus className="size-4" />
					</Button>
				</div>
			</div>

			{!isViewTypeGrid ? (
				<div className="space-y-0">
					{data.map((itemData) => (
						<IssueLine {...itemData} key={itemData.issue.id} layoutId={true} />
					))}
				</div>
			) : (
				<IssueGridList data={data} issueStatus={issueStatus} />
			)}
		</div>
	);
}

const IssueGridList: FC<{
	data: { issue: Issue; issueStatus: IssueStatus }[];
	issueStatus: IssueStatus;
}> = ({ data, issueStatus }) => {
	const ref = useRef<HTMLDivElement>(null);
	const { updateIssueStatus } = useIssuesStore();

	// Set up drop functionality to accept only issue items.
	const [{ isOver }, drop] = useDrop(() => ({
		accept: IssueDragType,
		drop(item: Issue, monitor) {
			if (monitor.didDrop() && item.statusId !== issueStatus.id) {
				updateIssueStatus(item.id, issueStatus);
			}
		},
		collect: (monitor) => ({
			isOver: !!monitor.isOver(),
		}),
	}));
	drop(ref);

	return (
		<div
			ref={ref}
			className="relative h-full flex-1 space-y-2 overflow-y-auto bg-zinc-50/50 p-2 dark:bg-zinc-900/50"
		>
			<AnimatePresence>
				{isOver && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.1 }}
						className="pointer-events-none fixed top-0 right-0 bottom-0 left-0 z-10 flex items-center justify-center bg-background/90"
						style={{
							width: ref.current?.getBoundingClientRect().width || "100%",
							height: ref.current?.getBoundingClientRect().height || "100%",
							transform: `translate(${ref.current?.getBoundingClientRect().left || 0}px, ${ref.current?.getBoundingClientRect().top || 0}px)`,
						}}
					>
						<div className="max-w-[90%] rounded-md border border-border bg-background p-3 shadow-md">
							<p className="text-center font-medium text-sm">
								Board ordered by priority
							</p>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
			{data.map((itemData) => (
				<IssueGrid key={itemData.issue.id} {...itemData} />
			))}
		</div>
	);
};

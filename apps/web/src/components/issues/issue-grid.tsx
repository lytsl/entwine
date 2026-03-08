"use client";

import { format } from "date-fns";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import {
	type DragSourceMonitor,
	useDrag,
	useDragLayer,
	useDrop,
} from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { Issue } from "@/mock-data/issues";
import { AssigneeUser } from "./assignee-user";
import { IssueContextMenu } from "./issue-context-menu";
import { LabelBadge } from "./label-badge";
import { PrioritySelector } from "./priority-selector";
import { ProjectBadge } from "./project-badge";
import { StatusSelector } from "./status-selector";

export const IssueDragType = "ISSUE";
type IssueGridProps = {
	issue: Issue;
};

// Custom DragLayer component to render the drag preview
function IssueDragPreview({ issue }: { issue: Issue }) {
	return (
		<div className="w-full overflow-hidden rounded-md border border-border/50 bg-background p-3">
			<div className="mb-2 flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<PrioritySelector priority={issue.priority} issueId={issue.id} />
					<span className="font-medium text-muted-foreground text-xs">
						{issue.identifier}
					</span>
				</div>
				<StatusSelector status={issue.status} issueId={issue.id} />
			</div>

			<h3 className="mb-3 line-clamp-2 font-semibold text-sm">{issue.title}</h3>

			<div className="mb-3 flex min-h-[1.5rem] flex-wrap gap-1.5">
				<LabelBadge label={issue.labels} />
				{issue.project && <ProjectBadge project={issue.project} />}
			</div>

			<div className="mt-auto flex items-center justify-between pt-2">
				<span className="text-muted-foreground text-xs">
					{format(new Date(issue.createdAt), "MMM dd")}
				</span>
				<AssigneeUser user={issue.assignee} />
			</div>
		</div>
	);
}

// Custom DragLayer to show custom preview during drag
export function CustomDragLayer() {
	const { itemType, isDragging, item, currentOffset } = useDragLayer(
		(monitor) => ({
			item: monitor.getItem() as Issue,
			itemType: monitor.getItemType(),
			currentOffset: monitor.getSourceClientOffset(),
			isDragging: monitor.isDragging(),
		}),
	);

	if (!isDragging || itemType !== IssueDragType || !currentOffset) {
		return null;
	}

	return (
		<div
			className="pointer-events-none fixed top-0 left-0 z-50"
			style={{
				transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
				width: "348px", // Match the width of your cards
			}}
		>
			<IssueDragPreview issue={item} />
		</div>
	);
}

export function IssueGrid({ issue }: IssueGridProps) {
	const ref = useRef<HTMLDivElement>(null);

	// Set up drag functionality.
	const [{ isDragging }, drag, preview] = useDrag(() => ({
		type: IssueDragType,
		item: issue,
		collect: (monitor: DragSourceMonitor) => ({
			isDragging: monitor.isDragging(),
		}),
	}));

	// Use empty image as drag preview (we'll create a custom one with DragLayer)
	useEffect(() => {
		preview(getEmptyImage(), { captureDraggingState: true });
	}, [preview]);

	// Set up drop functionality.
	const [, drop] = useDrop(() => ({
		accept: IssueDragType,
	}));

	// Connect drag and drop to the element.
	drag(drop(ref));

	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<motion.div
						ref={ref}
						className="w-full cursor-default rounded-md border border-border/50 bg-background p-3 shadow-xs"
						layoutId={`issue-grid-${issue.identifier}`}
						style={{
							opacity: isDragging ? 0.5 : 1,
							cursor: isDragging ? "grabbing" : "default",
						}}
					/>
				}
			>
				<div className="mb-2 flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<PrioritySelector priority={issue.priority} issueId={issue.id} />
						<span className="font-medium text-muted-foreground text-xs">
							{issue.identifier}
						</span>
					</div>
					<StatusSelector status={issue.status} issueId={issue.id} />
				</div>
				<h3 className="mb-3 line-clamp-2 font-semibold text-sm">
					{issue.title}
				</h3>
				<div className="mb-3 flex min-h-[1.5rem] flex-wrap gap-1.5">
					<LabelBadge label={issue.labels} />
					{issue.project && <ProjectBadge project={issue.project} />}
				</div>
				<div className="mt-auto flex items-center justify-between pt-2">
					<span className="text-muted-foreground text-xs">
						{format(new Date(issue.createdAt), "MMM dd")}
					</span>
					<AssigneeUser user={issue.assignee} />
				</div>
			</ContextMenuTrigger>
			<IssueContextMenu issueId={issue.id} />
		</ContextMenu>
	);
}

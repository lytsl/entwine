"use client";

import { format } from "date-fns";
import { motion } from "motion/react";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { Issue } from "@/mock-data/issues";
import { AssigneeUser } from "./assignee-user";
import { IssueContextMenu } from "./issue-context-menu";
import { LabelBadge } from "./label-badge";
import { PrioritySelector } from "./priority-selector";
import { ProjectBadge } from "./project-badge";
import { StatusSelector } from "./status-selector";

export function IssueLine({
	issue,
	layoutId = false,
}: {
	issue: Issue;
	layoutId?: boolean;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger
				render={
					<motion.div
						{...(layoutId && { layoutId: `issue-line-${issue.identifier}` })}
						//href={`/lndev-ui/issue/${issue.identifier}`}
						className="flex h-11 w-full items-center justify-start px-6 hover:bg-sidebar/50"
					/>
				}
			>
				<div className="flex items-center gap-0.5">
					<PrioritySelector priority={issue.priority} issueId={issue.id} />
					<span className="mr-0.5 hidden w-[66px] shrink-0 truncate font-medium text-muted-foreground text-sm sm:inline-block">
						{issue.identifier}
					</span>
					<StatusSelector status={issue.status} issueId={issue.id} />
				</div>
				<span className="mr-1 ml-0.5 flex min-w-0 items-center justify-start">
					<span className="truncate font-medium text-xs sm:font-semibold sm:text-sm">
						{issue.title}
					</span>
				</span>
				<div className="ml-auto flex items-center justify-end gap-2 sm:w-fit">
					<div className="w-3 shrink-0" />
					<div className="hidden items-center justify-end -space-x-5 transition-all duration-200 hover:space-x-1 sm:flex lg:space-x-1">
						<LabelBadge label={issue.labels} />
						{issue.project && <ProjectBadge project={issue.project} />}
					</div>
					<span className="hidden shrink-0 text-muted-foreground text-xs sm:inline-block">
						{format(new Date(issue.createdAt), "MMM dd")}
					</span>
					<AssigneeUser user={issue.assignee} />
				</div>
			</ContextMenuTrigger>
			<IssueContextMenu issueId={issue.id} />
		</ContextMenu>
	);
}

"use client";

import { CreateNewIssue } from "@/routes/$orgId/-components/create-new-issue";

export function CreateIssueModalProvider() {
	return (
		<div className="hidden">
			<CreateNewIssue />
		</div>
	);
}

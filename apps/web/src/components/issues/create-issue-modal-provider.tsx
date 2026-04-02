"use client";

import { CreateNewIssue } from "@/routes/$orgSlug/-components/create-new-issue";

export function CreateIssueModalProvider() {
	return (
		<div className="hidden">
			<CreateNewIssue />
		</div>
	);
}

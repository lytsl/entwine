"use client";

import { useEffect, useState } from "react";
import { useIssuesStore } from "@/store/issues-store";
import { useSearchStore } from "@/store/search-store";
import { IssueLine } from "./issue-line";

export function SearchIssues() {
	const [searchResults, setSearchResults] = useState<
		ReturnType<typeof useIssuesStore.getState>["issues"]
	>([]);
	const { searchIssues } = useIssuesStore();
	const { searchQuery, isSearchOpen } = useSearchStore();

	useEffect(() => {
		if (searchQuery.trim() === "") {
			setSearchResults([]);
			return;
		}

		const results = searchIssues(searchQuery);
		setSearchResults(results);
	}, [searchQuery, searchIssues]);

	if (!isSearchOpen) {
		return null;
	}

	return (
		<div className="w-full">
			{searchQuery.trim() !== "" && (
				<div>
					{searchResults.length > 0 ? (
						<div className="mt-4 rounded-md border">
							<div className="border-b bg-muted/50 px-4 py-2">
								<h3 className="font-medium text-sm">
									Results ({searchResults.length})
								</h3>
							</div>
							<div className="divide-y">
								{searchResults.map((issue) => (
									<IssueLine key={issue.id} issue={issue} layoutId={false} />
								))}
							</div>
						</div>
					) : (
						<div className="py-8 text-center text-muted-foreground">
							No results found for &quot;{searchQuery}&quot;
						</div>
					)}
				</div>
			)}
		</div>
	);
}

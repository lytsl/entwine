"use client";

import { type FC, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { cn } from "@/lib/utils";
import type { Issue } from "@/mock-data/issues";
import { status } from "@/mock-data/status";
import { useFilterStore } from "@/store/filter-store";
import { useIssuesStore } from "@/store/issues-store";
import { useSearchStore } from "@/store/search-store";
import { useViewStore } from "@/store/view-store";
import { GroupIssues } from "./group-issues";
import { CustomDragLayer } from "./issue-grid";
import { SearchIssues } from "./search-issues";
import { Route, useOrgRoutContext } from "@/routes/$orgSlug/layout";
import type { TanStackCollections } from "@/lib/collection-wrapper";
import type { idbSchema } from "@/lib/db/schema";
import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";

export default function AllIssues() {
  const { isSearchOpen, searchQuery } = useSearchStore();
  const { viewType } = useViewStore();
  const { hasActiveFilters } = useFilterStore();

  const isSearching = isSearchOpen && searchQuery.trim() !== "";
  const isViewTypeGrid = viewType === "grid";

  const isFiltering = hasActiveFilters();

  return (
    <div
      className={cn("min-h-0 w-full flex-1", {
        "overflow-x-auto": isViewTypeGrid,
        "overflow-y-auto": !isViewTypeGrid,
      })}
    >
      {isSearching ? (
        <SearchIssuesView />
      ) : isFiltering ? (
        <FilteredIssuesView isViewTypeGrid={isViewTypeGrid} />
      ) : (
        <GroupIssuesListView isViewTypeGrid={isViewTypeGrid} />
      )}
    </div>
  );
}

const SearchIssuesView = () => (
  <div className="mb-6 px-6">
    <SearchIssues />
  </div>
);

const FilteredIssuesView: FC<{
  isViewTypeGrid: boolean;
}> = ({ isViewTypeGrid = false }) => {
  const { collections } = useOrgRoutContext();

  const { filters } = useFilterStore();
  const { filterIssues } = useIssuesStore();

  // Apply filters to get filtered issues
  const filteredIssues = useMemo(() => {
    return filterIssues(filters);
  }, [filterIssues, filters]);

  // Group filtered issues by status
  const filteredIssuesByStatus = useMemo(() => {
    const result: Record<string, Issue[]> = {};

    status.forEach((statusItem) => {
      result[statusItem.id] = filteredIssues.filter(
        (issue) => issue.statusId === statusItem.id,
      );
    });

    return result;
  }, [filteredIssues]);

  const issueQuery = useLiveSuspenseQuery((q) =>
    q
      .from({ issue: collections.Issue })
      .leftJoin(
        { issueStatus: collections.IssueStatus },
        ({ issue, issueStatus }) => eq(issue.statusId, issueStatus.id),
      )
      .leftJoin({ project: collections.Project }, ({ issue, project }) =>
        eq(issue.projectId, project.id),
      )
      .orderBy(({ issue }) => issue.priority, "asc"),
  );

  const issueGroupedData = Object.entries(
    Object.groupBy(issueQuery.data, (d) => d.issue.statusId),
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer />
      <div
        className={cn(
          isViewTypeGrid && "flex h-full min-w-max gap-3 px-2 py-2",
        )}
      >
        {issueGroupedData.map(([statusId, data]) => {
          const status = data?.[0]?.issueStatus;
          if (!status) return null;

          return (
            <GroupIssues
              key={statusId}
              issueStatus={status}
              data={data || []}
              count={data?.length || 0}
              isViewTypeGrid={isViewTypeGrid}
            />
          );
        })}
      </div>
    </DndProvider>
  );
};

const GroupIssuesListView: FC<{
  isViewTypeGrid: boolean;
}> = ({ isViewTypeGrid = false }) => {
  const { collections } = useOrgRoutContext();

  const issueQuery = useLiveSuspenseQuery((q) =>
    q
      .from({ issue: collections.Issue })
      .leftJoin(
        { issueStatus: collections.IssueStatus },
        ({ issue, issueStatus }) => eq(issue.statusId, issueStatus.id),
      )
      .leftJoin({ project: collections.Project }, ({ issue, project }) =>
        eq(issue.projectId, project.id),
      )
      .orderBy(({ issue }) => issue.priority, "asc"),
  );

  const issueGroupedData = Object.entries(
    Object.groupBy(issueQuery.data, (d) => d.issue.statusId),
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <CustomDragLayer />
      <div
        className={cn(
          isViewTypeGrid && "flex h-full min-w-max gap-3 px-2 py-2",
        )}
      >
        {issueGroupedData.map(([statusId, data]) => {
          const status = data?.[0]?.issueStatus;
          if (!status) return null;

          return (
            <GroupIssues
              key={statusId}
              issueStatus={status}
              data={data || []}
              count={data?.length || 0}
              isViewTypeGrid={isViewTypeGrid}
            />
          );
        })}
      </div>
    </DndProvider>
  );
};

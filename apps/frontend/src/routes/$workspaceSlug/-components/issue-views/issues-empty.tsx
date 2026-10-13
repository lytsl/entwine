import { Button } from "@entwine/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@entwine/ui/components/ui/empty";
import { LayersIcon, PlusIcon } from "lucide-react";

export function IssuesEmpty({
  filtered,
  onClearFilters,
  onNewIssue,
}: {
  /** Whether a search or a filter is applied, which may be all that hides the issues. */
  filtered: boolean;
  onClearFilters(): void;
  onNewIssue(): void;
}) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LayersIcon />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "No issues match" : "No issues yet"}</EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Nothing here matches the search and filters."
            : "Issues you create here show up in this view. Press C to create one."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {filtered ? (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button size="sm" onClick={onNewIssue}>
            <PlusIcon />
            New issue
          </Button>
        )}
      </EmptyContent>
    </Empty>
  );
}

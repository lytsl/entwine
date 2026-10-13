import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@entwine/ui/components/ui/command";
import { useIssueSearch } from "../../../../../hooks/use-issue-search";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { IssueOption } from "../../pickers/issue-option";

export function IssueSearchDialog({
  title,
  store,
  issues,
  onSelect,
  onClose,
}: {
  title: string;
  store: Store;
  issues: Issue[];
  onSelect(issue: Issue): void;
  onClose(): void;
}) {
  const { search, setSearch, found } = useIssueSearch(store, issues);
  return (
    <CommandDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      description="Search by key or title"
      className="sm:max-w-xl"
    >
      <Command className="bg-transparent">
        <CommandInput
          placeholder={`${title}: find an issue…`}
          aria-label="Find an issue"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-96">
          <CommandEmpty className="py-6 text-body text-muted-foreground">No issues</CommandEmpty>
          <CommandGroup heading={title}>
            {found.map((issue) => (
              <IssueOption
                key={issue.id}
                issue={issue}
                store={store}
                onSelect={() => {
                  onSelect(issue);
                  onClose();
                }}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

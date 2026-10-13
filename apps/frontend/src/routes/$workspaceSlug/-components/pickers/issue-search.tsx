import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from "@entwine/ui/components/ui/command";
import { useMemo } from "react";
import { useIssueSearch } from "../../../../hooks/use-issue-search";
import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { IssueOption } from "./issue-option";

export function IssueSearch({
  store,
  issues,
  placeholder,
  onSelect,
}: {
  store: Store;
  issues(): Issue[];
  placeholder: string;
  onSelect(issue: Issue): void;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `issues` is a new function at every render of the page.
  const candidates = useMemo(issues, [store]);
  const { search, setSearch, found } = useIssueSearch(store, candidates);
  return (
    <Command className="rounded-md! bg-transparent">
      <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty className="py-4 text-caption text-muted-foreground">No issues</CommandEmpty>
        <CommandGroup>
          {found.map((issue) => (
            <IssueOption key={issue.id} issue={issue} store={store} onSelect={() => onSelect(issue)} />
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

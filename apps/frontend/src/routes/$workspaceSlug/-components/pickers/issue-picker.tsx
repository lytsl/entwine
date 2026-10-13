import { Popover, PopoverContent, PopoverTrigger } from "@entwine/ui/components/ui/popover";
import { type ReactElement, useState } from "react";
import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { IssueSearch } from "./issue-search";

/** The issues are asked for when it opens: going through a project's is not for every render of the page. */
export function IssuePicker({
  store,
  issues,
  trigger,
  placeholder = "Find an issue…",
  onSelect,
}: {
  store: Store;
  issues(): Issue[];
  trigger: ReactElement;
  placeholder?: string;
  onSelect(issue: Issue): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent className="w-96 gap-0 p-0" align="start">
        <IssueSearch
          store={store}
          issues={issues}
          placeholder={placeholder}
          onSelect={(issue) => {
            setOpen(false);
            onSelect(issue);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

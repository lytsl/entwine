import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { Button } from "@entwine/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@entwine/ui/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { toast } from "@entwine/ui/components/ui/toast";
import { cn } from "@entwine/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useIssueSearch } from "../../../../hooks/use-issue-search";
import { toggledList } from "../../../../lib/toggle";
import type { Store } from "../../../../store";
import type { Cycle, Issue, Module, PlanKind } from "../../../../types/rows";

/** For a cycle, an issue in another cycle says so, since adding it moves it here. */
export function AddExistingDialog({
  kind,
  plan,
  store,
  onClose,
}: {
  kind: PlanKind;
  plan: Cycle | Module;
  store: Store;
  onClose(): void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const inPlan = (issue: Issue) =>
    kind === "cycle" ? issue.cycleId === plan.id : store.issues.inModule(plan.id, issue.id);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the issues to pick from are those of when it opened.
  const candidates = useMemo(
    () => store.issues.list(store.issues.scope({ projectId: plan.projectId })).filter((issue) => !inPlan(issue)),
    [],
  );
  const { search, setSearch, found } = useIssueSearch(store, candidates);
  const add = () => {
    void (kind === "cycle" ? store.issues.update(chosen, { cycleId: plan.id }) : store.modules.add(chosen, plan.id));
    toast.success(`${chosen.length} ${chosen.length === 1 ? "issue" : "issues"} added to ${plan.name}`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Add existing issues</DialogTitle>
          <DialogDescription>
            {kind === "cycle"
              ? `Issues in another cycle move to ${plan.name}.`
              : `Issues keep their other modules and join ${plan.name}.`}
          </DialogDescription>
        </DialogHeader>
        <Command className="rounded-none! border-y bg-transparent">
          <CommandInput placeholder="Search by key or title…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-80">
            <CommandEmpty className="py-6 text-caption text-muted-foreground">No issues to add</CommandEmpty>
            <CommandGroup>
              {found.map((issue) => {
                const key = store.issues.key(issue);
                const state = store.states.get(issue.stateId);
                const other = kind === "cycle" && issue.cycleId ? store.cycles.get(issue.cycleId) : undefined;
                const checked = chosen.includes(issue.id);
                return (
                  <CommandItem
                    key={issue.id}
                    data-checked={checked}
                    aria-selected={checked}
                    className="text-body"
                    onSelect={() => setChosen((ids) => toggledList(ids, issue.id))}
                  >
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {checked && <CheckIcon className="size-2.5!" strokeWidth={3} />}
                    </span>
                    {state && <StateIcon type={state.group} color={state.color} className="size-3.5!" />}
                    <span className="w-16 shrink-0 text-caption text-muted-foreground">{key}</span>
                    <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                    {other && <span className="text-caption text-muted-foreground">in {other.name}</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-end gap-2 p-3">
          <span className="mr-auto text-caption text-muted-foreground">
            {chosen.length ? `${chosen.length} selected` : "Select issues to add"}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!chosen.length} onClick={add}>
            Add {chosen.length || ""} {chosen.length === 1 ? "issue" : "issues"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

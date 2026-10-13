/** A stack of pages: the root and one list of choices per issue property; Backspace in an empty search goes back. */
import { Command, CommandDialog, CommandEmpty, CommandInput, CommandList } from "@entwine/ui/components/ui/command";
import { useState } from "react";
import type { CommandContext } from "../../../../types/command";
import type { PalettePage } from "../../../../types/shell";
import { PropertyPage } from "./property-page";
import { RootPage } from "./root-page";

const PLACEHOLDERS: Record<PalettePage, string> = {
  root: "Type a command or search…",
  state: "Change state…",
  priority: "Set priority…",
  assignee: "Assign to…",
  labels: "Toggle labels…",
  estimate: "Estimate…",
  cycle: "Move to cycle…",
  modules: "Toggle modules…",
};

export function CommandPalette({
  stack,
  onStack,
  onClose,
  ctx,
}: {
  stack: PalettePage[];
  onStack(stack: PalettePage[]): void;
  onClose(): void;
  ctx: CommandContext;
}) {
  const [search, setSearch] = useState("");
  const page = stack[stack.length - 1] ?? "root";
  return (
    <CommandDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Command palette"
      description="Search the workspace or run a command"
      className="sm:max-w-xl"
    >
      <Command
        loop
        onKeyDown={(event) => {
          if (event.key === "Backspace" && !search && stack.length > 1) {
            event.preventDefault();
            setSearch("");
            onStack(stack.slice(0, -1));
          }
        }}
      >
        <CommandInput autoFocus placeholder={PLACEHOLDERS[page]} value={search} onValueChange={setSearch} />
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandEmpty className="py-6 text-center text-body text-muted-foreground">No results</CommandEmpty>
          {page === "root" ? (
            <RootPage
              search={search}
              ctx={ctx}
              onClose={onClose}
              onCommand={(command) => {
                if (command.stays) setSearch("");
                else onClose();
                command.run();
              }}
            />
          ) : (
            <PropertyPage page={page} search={search} ctx={ctx} onClose={onClose} />
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

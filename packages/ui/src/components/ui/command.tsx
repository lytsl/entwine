"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { InputGroup, InputGroupAddon } from "@entwine/ui/components/ui/input-group";
import { Separator } from "@entwine/ui/components/ui/separator";
import { cn } from "@entwine/ui/lib/utils";
import { CheckIcon, SearchIcon } from "lucide-react";
import * as React from "react";

const ITEM = "[data-slot=command-item]";

/**
 * Which item is active, and whether there is any. The items are read from the DOM, which holds them in the order
 * shown, and each component follows only its own part, so moving through a long list renders two items.
 */
function createCommandState(root: React.RefObject<HTMLElement | null>, listId: string) {
  /** `chosen` is the item the member moved to; without one, or once it is gone, the first item is active. */
  let state: { chosen: string | null; active: string | null; empty: boolean } = {
    chosen: null,
    active: null,
    empty: true,
  };
  let pending = false;
  const listeners = new Set<() => void>();
  const items = () => [...(root.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
  const choose = (chosen: string | null) => {
    const all = items();
    const active = all.some((item) => item.id === chosen) ? chosen : (all[0]?.id ?? null);
    if (chosen === state.chosen && active === state.active && (all.length === 0) === state.empty) return;
    state = { chosen, active, empty: all.length === 0 };
    for (const listener of listeners) listener();
  };
  return {
    listId,
    items,
    choose,
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Called as items come and go, and read once the DOM has settled: an unmounting item is still in it. */
    sync() {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        choose(state.chosen);
      });
    },
  };
}

type CommandState = ReturnType<typeof createCommandState>;

const CommandContext = React.createContext<CommandState | null>(null);

function useCommand<T>(read: (state: ReturnType<CommandState["get"]>) => T): [T, CommandState] {
  const command = React.useContext(CommandContext);
  if (!command) throw new Error("Command parts must be inside a Command");
  return [React.useSyncExternalStore(command.subscribe, () => read(command.get())), command];
}

/** A search field over a list of options: the field keeps the focus while the arrow keys move through the list. */
function Command({
  className,
  loop = false,
  onKeyDown,
  ...props
}: React.ComponentProps<"div"> & {
  loop?: boolean;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const [command] = React.useState(() => createCommandState(root, listId));
  return (
    <CommandContext.Provider value={command}>
      <div
        ref={root}
        data-slot="command"
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
          className,
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.nativeEvent.isComposing) return;
          const items = command.items();
          const last = items.length - 1;
          const at = items.findIndex((item) => item.id === command.get().active);
          const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: last }[event.key];
          if (to !== undefined) {
            event.preventDefault();
            const item = items[loop ? (to + items.length) % items.length : Math.min(Math.max(to, 0), last)];
            if (!item) return;
            command.choose(item.id);
            const group = item.closest("[data-slot=command-group]");
            if (group?.querySelector(ITEM) === item) group.firstElementChild?.scrollIntoView({ block: "nearest" });
            item.scrollIntoView({ block: "nearest" });
          } else if (event.key === "Enter") {
            event.preventDefault();
            items[at]?.click();
          }
        }}
        {...props}
      />
    </CommandContext.Provider>
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn("top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0", className)}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  onValueChange,
  ...props
}: React.ComponentProps<"input"> & { onValueChange?(value: string): void }) {
  const [active, command] = useCommand((state) => state.active);
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <input
          data-slot="command-input"
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={command.listId}
          aria-autocomplete="list"
          aria-activedescendant={active ?? undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 max-md:text-base",
            className,
          )}
          onChange={(event) => {
            onValueChange?.(event.target.value);
            // Another search is another list, whose best match is its first item.
            command.choose(null);
            command.sync();
          }}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<"div">) {
  const [, command] = useCommand(() => null);
  return (
    <div
      id={command.listId}
      role="listbox"
      aria-label="Suggestions"
      tabIndex={-1}
      data-slot="command-list"
      className={cn("no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none", className)}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<"div">) {
  const [empty] = useCommand((state) => state.empty);
  if (!empty) return null;
  return (
    <div
      role="presentation"
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<"div"> & { heading?: React.ReactNode }) {
  const headingId = React.useId();
  return (
    <div
      role="presentation"
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground has-[>[role=group]:empty]:hidden", className)}
      {...props}
    >
      {heading && (
        <div
          id={headingId}
          aria-hidden
          data-slot="command-group-heading"
          className="px-2 py-1.5 text-xs font-medium text-muted-foreground"
        >
          {heading}
        </div>
      )}
      <div role="group" aria-labelledby={heading ? headingId : undefined}>
        {children}
      </div>
    </div>
  );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-slot="command-separator" className={cn("-mx-1 w-auto", className)} {...props} />;
}

function CommandItem({
  className,
  children,
  onSelect,
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & { onSelect?(): void }) {
  const id = React.useId();
  const [active, command] = useCommand((state) => state.active === id);
  React.useLayoutEffect(() => {
    command.sync();
    return command.sync;
  }, [command]);
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      data-selected={active || undefined}
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:**:[svg]:text-foreground",
        className,
      )}
      // Not on enter: a list that scrolls under a resting pointer would change the active item.
      onPointerMove={() => command.choose(id)}
      onClick={onSelect}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </div>
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};

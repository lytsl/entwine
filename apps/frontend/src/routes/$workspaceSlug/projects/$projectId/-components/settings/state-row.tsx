import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { cn } from "@entwine/ui/lib/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleCheckIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "../../../../../../hooks/use-store";
import { type State } from "../../../../../../types/rows";
import { StateForm } from "./state-form";

export function StateRow({
  state,
  first,
  last,
  issueCount,
  isDefault,
  dropBefore,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOverRow,
  onMove,
  onDelete,
}: {
  state: State;
  first: boolean;
  last: boolean;
  issueCount: number;
  isDefault: boolean;
  dropBefore: boolean;
  dragging: boolean;
  onDragStart(): void;
  onDragEnd(): void;
  /** The pointer is over the row's top half (`true`) or bottom half. */
  onDragOverRow(before: boolean): void;
  onMove(delta: number): void;
  onDelete(): void;
}) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const setDefault = () => store.projects.update(state.projectId, { defaultStateId: state.id });
  if (editing)
    return <StateForm projectId={state.projectId} group={state.group} state={state} onDone={() => setEditing(false)} />;
  return (
    <>
      {dropBefore && <div className="mx-3 h-0.5 rounded-full bg-primary" />}
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/state-id", state.id);
          event.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          // The row decides where the drop goes; its group card would otherwise reset it to the end.
          event.preventDefault();
          event.stopPropagation();
          const box = event.currentTarget.getBoundingClientRect();
          onDragOverRow(event.clientY < box.top + box.height / 2);
        }}
        className={cn(
          "group/state relative flex h-11 items-center gap-2.5 border-t pr-2 pl-2 transition-colors hover:bg-accent/40",
          dragging && "opacity-40",
        )}
        data-testid="state-row"
      >
        <GripVerticalIcon className="size-3.5 shrink-0 cursor-grab text-muted-foreground hover-reveal group-hover/state:opacity-100" />
        <StateIcon type={state.group} color={state.color} />
        <span className="min-w-0 truncate text-body font-medium">{state.name}</span>
        {isDefault && (
          <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-micro font-medium text-primary-text">
            Default
          </span>
        )}
        <span className="hidden shrink-0 text-caption text-muted-foreground @min-[30rem]/main:inline">
          {issueCount} {issueCount === 1 ? "issue" : "issues"}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5 hover-reveal group-hover/state:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100">
          {!isDefault && (
            <Button
              variant="ghost"
              size="xs"
              className="hidden text-muted-foreground @min-[30rem]/main:inline-flex"
              onClick={setDefault}
            >
              Set as default
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" aria-label={`Edit ${state.name}`} onClick={() => setEditing(true)}>
            <PencilIcon />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-xs" aria-label={`${state.name} actions`} />}
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {/* Also here: a narrow row has no room for the button beside the name. */}
              {!isDefault && (
                <DropdownMenuItem onClick={setDefault}>
                  <CircleCheckIcon />
                  Set as default
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={first} onClick={() => onMove(-1)}>
                <ArrowUpIcon />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={last} onClick={() => onMove(1)}>
                <ArrowDownIcon />
                Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={isDefault} onClick={onDelete}>
                <Trash2Icon />
                {isDefault ? "Default can't be deleted" : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
    </>
  );
}

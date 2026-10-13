import { STATE_GROUPS, type StateGroup } from "@entwine/shared";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { Button } from "@entwine/ui/components/ui/button";
import { cn } from "@entwine/ui/lib/utils";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { type DragEvent, useState } from "react";
import { GROUP_LABELS } from "../../../../../../constants/state";
import { toggledSet } from "../../../../../../lib/toggle";
import { type Store } from "../../../../../../store";
import { type Project, type State } from "../../../../../../types/rows";
import { DeleteStateDialog } from "./delete-state-dialog";
import { StateForm } from "./state-form";
import { StateRow } from "./state-row";

type DropTarget = { group: StateGroup; before: string | null } | null;

export function StatesEditor({ project, store }: { project: Project; store: Store }) {
  const [adding, setAdding] = useState<StateGroup | null>(null);
  const [deleting, setDeleting] = useState<State | null>(null);
  const [folded, setFolded] = useState<Set<StateGroup>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget>(null);
  const counts = store.issues.stateCounts(project.id);
  const states = store.states.of(project.id);

  const drop = (group: StateGroup, before: string | null) => {
    const id = dragging;
    setDragging(null);
    setTarget(null);
    if (!id) return;
    const ids = states.filter((s) => s.group === group && s.id !== id).map((s) => s.id);
    const at = before ? ids.indexOf(before) : -1;
    ids.splice(at === -1 ? ids.length : at, 0, id);
    const current = states.filter((s) => s.group === group).map((s) => s.id);
    if (JSON.stringify(ids) !== JSON.stringify(current)) void store.states.move(id, group, ids);
  };
  const move = (state: State, delta: number) => {
    const ids = states.filter((s) => s.group === state.group).map((s) => s.id);
    const index = ids.indexOf(state.id);
    ids.splice(index, 1);
    ids.splice(index + delta, 0, state.id);
    void store.states.move(state.id, state.group, ids);
  };

  return (
    <div className="flex flex-col gap-3">
      {STATE_GROUPS.map((group) => {
        const inGroup = states.filter((s) => s.group === group);
        const open = !folded.has(group);
        return (
          <div
            key={group}
            role="group"
            aria-label={GROUP_LABELS[group]}
            className={cn(
              "overflow-hidden rounded-xl border bg-card/40 transition-colors",
              dragging && target?.group === group && "border-primary/50 bg-primary/5",
            )}
            onDragOver={(event: DragEvent) => {
              if (!dragging) return;
              event.preventDefault();
              if (target?.group !== group) setTarget({ group, before: null });
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop(group, target?.group === group ? target.before : null);
            }}
          >
            <div className="flex h-11 items-center gap-2 pr-2 pl-3">
              <button
                type="button"
                aria-expanded={open}
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => setFolded((groups) => toggledSet(groups, group))}
              >
                <ChevronRightIcon
                  className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")}
                />
                <StateIcon type={group} color="var(--muted-foreground)" />
                <span className="text-body font-medium">{GROUP_LABELS[group]}</span>
                <span className="text-caption text-muted-foreground">{inGroup.length}</span>
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Add a ${GROUP_LABELS[group].toLowerCase()} state`}
                title="Add state"
                onClick={() => {
                  setAdding(group);
                  setFolded((groups) => new Set([...groups].filter((g) => g !== group)));
                }}
              >
                <PlusIcon />
              </Button>
            </div>
            {open && (
              <>
                {inGroup.map((state, index) => (
                  <StateRow
                    key={state.id}
                    state={state}
                    first={index === 0}
                    last={index === inGroup.length - 1}
                    issueCount={counts.get(state.id) ?? 0}
                    isDefault={project.defaultStateId === state.id}
                    dropBefore={!!dragging && target?.group === group && target.before === state.id}
                    dragging={dragging === state.id}
                    onDragStart={() => setDragging(state.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setTarget(null);
                    }}
                    onDragOverRow={(before) =>
                      setTarget({ group, before: before ? state.id : (inGroup[index + 1]?.id ?? null) })
                    }
                    onMove={(delta) => move(state, delta)}
                    onDelete={() => setDeleting(state)}
                  />
                ))}
                {dragging && target?.group === group && target.before === null && (
                  <div className="mx-3 h-0.5 rounded-full bg-primary" />
                )}
                {adding === group && <StateForm projectId={project.id} group={group} onDone={() => setAdding(null)} />}
              </>
            )}
          </div>
        );
      })}
      {deleting && (
        <DeleteStateDialog
          state={deleting}
          states={states}
          issueCount={counts.get(deleting.id) ?? 0}
          defaultStateId={project.defaultStateId}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

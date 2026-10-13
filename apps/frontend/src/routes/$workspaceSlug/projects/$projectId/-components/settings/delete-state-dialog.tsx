import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";
import { useState } from "react";
import { useStore } from "../../../../../../hooks/use-store";
import { type State } from "../../../../../../types/rows";

/** A transaction holds at most 500 mutations: the moves plus the delete. */
const MAX_MOVED = 499;

export function DeleteStateDialog({
  state,
  states,
  issueCount,
  defaultStateId,
  onClose,
}: {
  state: State;
  states: State[];
  issueCount: number;
  defaultStateId: string;
  onClose(): void;
}) {
  const store = useStore();
  const others = states.filter((s) => s.id !== state.id);
  const [moveTo, setMoveTo] = useState(defaultStateId);
  const target = others.find((s) => s.id === moveTo);
  return (
    <ConfirmDialog
      title={`Delete ${state.name}?`}
      description={
        issueCount === 0
          ? "No issues are in this state."
          : issueCount > MAX_MOVED
            ? `${issueCount} issues are in this state, more than can move at once. Move some of them first.`
            : `${issueCount} ${issueCount === 1 ? "issue is" : "issues are"} in this state. Move them to:`
      }
      confirmLabel="Delete state"
      disabled={issueCount > MAX_MOVED}
      onClose={onClose}
      onConfirm={() => {
        void store.states.delete(state.id, issueCount ? moveTo : null);
        onClose();
      }}
    >
      {issueCount > 0 && issueCount <= MAX_MOVED && (
        <PropertySelect<string>
          label={`Move issues to: ${target?.name ?? ""}`}
          face="field"
          className="h-9 border"
          searchPlaceholder="Move issues to…"
          options={others.map((s) => ({
            value: s.id,
            label: s.name,
            icon: <StateIcon type={s.group} color={s.color} />,
          }))}
          isSelected={(id) => id === moveTo}
          onSelect={setMoveTo}
        >
          {target && <StateIcon type={target.group} color={target.color} />}
          {target?.name}
        </PropertySelect>
      )}
    </ConfirmDialog>
  );
}

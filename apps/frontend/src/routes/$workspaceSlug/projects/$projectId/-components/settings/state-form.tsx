import { type StateGroup, stateInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { ColorPicker } from "@entwine/ui/components/ui/color-picker";
import { toast } from "@entwine/ui/components/ui/toast";
import { LABEL_COLORS } from "../../../../../../constants/label";
import { useAppForm } from "../../../../../../hooks/use-app-form";
import { useStore } from "../../../../../../hooks/use-store";
import { submits } from "../../../../../../lib/form";
import { type State } from "../../../../../../types/rows";
import { StateGroupPicker } from "./state-group-picker";

/** Names are unique in a project, which the local rows can check; the server checks again. */
export function StateForm({
  projectId,
  group,
  state,
  onDone,
}: {
  projectId: string;
  group: StateGroup;
  state?: State;
  onDone(): void;
}) {
  const store = useStore();
  const form = useAppForm({
    defaultValues: { name: state?.name ?? "", color: state?.color ?? LABEL_COLORS[5], group },
    validators: { onSubmit: stateInput },
    onSubmit: ({ value }) => {
      const name = value.name.trim();
      const other = store.states.find(projectId, name);
      if (!state) {
        if (other) return void toast.error(`State ${name} already exists`);
        void store.states.create(projectId, { name, color: value.color, group });
      } else {
        if (other && other.id !== state.id) return void toast.error(`State ${name} already exists in this project`);
        const ids = store.states
          .of(projectId)
          .filter((s) => s.group === value.group && s.id !== state.id)
          .map((s) => s.id);
        void store.states.update(state.id, { name, color: value.color });
        if (value.group !== state.group) void store.states.move(state.id, value.group, [...ids, state.id]);
      }
      onDone();
    },
  });
  return (
    <form.AppForm>
      <form className="flex items-center gap-2 border-t bg-accent/30 px-3 py-2" onSubmit={submits(form)}>
        <form.Field name="color">
          {(field) => (
            <ColorPicker
              value={field.state.value}
              onChange={field.handleChange}
              colors={LABEL_COLORS}
              label={state ? "State color" : "New state color"}
            />
          )}
        </form.Field>
        <form.AppField name="name">
          {(field) => (
            <field.InlineTextField
              className="h-8 flex-1"
              placeholder={state ? undefined : "State name"}
              aria-label={state ? "State name" : "New state name"}
              autoFocus
              onKeyDown={(event) => event.key === "Escape" && onDone()}
            />
          )}
        </form.AppField>
        {state && (
          <form.Subscribe selector={(form) => form.values.color}>
            {(color) => (
              <form.Field name="group">
                {(field) => <StateGroupPicker value={field.state.value} onChange={field.handleChange} color={color} />}
              </form.Field>
            )}
          </form.Subscribe>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <form.SubmitButton size="sm">{state ? "Save" : "Add state"}</form.SubmitButton>
      </form>
    </form.AppForm>
  );
}

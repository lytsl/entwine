import { addDays, type ModuleStatus, planInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@entwine/ui/components/ui/field";
import { toast } from "@entwine/ui/components/ui/toast";
import { useAppForm } from "../../../../hooks/use-app-form";
import { useStore } from "../../../../hooks/use-store";
import { useToday } from "../../../../hooks/use-today";
import { submits } from "../../../../lib/form";
import { type Cycle, type Module, type PlanKind } from "../../../../types/rows";
import { ModuleStatusSelect } from "./module-status-select";

const CYCLE_DAYS = 14;

export function PlanDialog({
  kind,
  projectId,
  plan,
  onClose,
}: {
  kind: PlanKind;
  projectId: string;
  plan?: Cycle | Module;
  onClose(): void;
}) {
  const store = useStore();
  const today = useToday();
  const cycle = kind === "cycle" ? (plan as Cycle | undefined) : undefined;
  const module = kind === "module" ? (plan as Module | undefined) : undefined;
  const noun = kind === "cycle" ? "Cycle" : "Module";
  const form = useAppForm({
    defaultValues: {
      kind,
      name: plan?.name ?? "",
      description: plan?.description ?? "",
      status: module?.status ?? "backlog",
      start: cycle?.startDate ?? module?.startDate ?? (kind === "cycle" && !plan ? today : null),
      end: cycle?.endDate ?? module?.targetDate ?? (kind === "cycle" && !plan ? addDays(today, CYCLE_DAYS - 1) : null),
    },
    validators: { onSubmit: planInput },
    onSubmit: ({ value }) => {
      const common = { name: value.name.trim(), description: value.description };
      if (kind === "cycle") {
        const input = { ...common, startDate: value.start!, endDate: value.end! };
        if (plan) void store.cycles.update(plan.id, input);
        else store.cycles.create(projectId, input);
      } else {
        const input = { ...common, status: value.status, startDate: value.start, targetDate: value.end };
        if (plan) void store.modules.update(plan.id, input);
        else store.modules.create(projectId, input);
      }
      if (!plan) toast.success(`${noun} ${common.name} created`);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${noun.toLowerCase()}` : `New ${noun.toLowerCase()}`}</DialogTitle>
          <DialogDescription>
            {kind === "cycle"
              ? "A cycle plans the project's work for a stretch of days. An issue is in one cycle at a time."
              : "A module gathers the issues of one deliverable. An issue can be in several modules."}
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form onSubmit={submits(form)}>
            <FieldGroup>
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label="Name"
                    autoFocus
                    maxLength={100}
                    placeholder={kind === "cycle" ? "Sprint 12" : "Checkout redesign"}
                  />
                )}
              </form.AppField>
              <form.AppField name="description">
                {(field) => <field.TextField label="Description" multiline />}
              </form.AppField>
              {kind === "module" && (
                <form.Field name="status">
                  {(field) => (
                    <Field>
                      <FieldLabel>Status</FieldLabel>
                      <ModuleStatusSelect value={field.state.value} onChange={field.handleChange} bordered />
                    </Field>
                  )}
                </form.Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <form.Subscribe selector={(state) => state.values.end}>
                  {(end) => (
                    <form.AppField name="start">
                      {(field) => <field.DateField label="Start date" max={end} required={kind === "cycle"} />}
                    </form.AppField>
                  )}
                </form.Subscribe>
                <form.Subscribe selector={(state) => state.values.start}>
                  {(start) => (
                    <form.AppField name="end">
                      {(field) => (
                        <field.DateField
                          label={kind === "cycle" ? "End date" : "Target date"}
                          min={start}
                          required={kind === "cycle"}
                        />
                      )}
                    </form.AppField>
                  )}
                </form.Subscribe>
              </div>
            </FieldGroup>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <form.SubmitButton>{plan ? "Save changes" : `Create ${noun.toLowerCase()}`}</form.SubmitButton>
            </div>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}

import { cycleScheduleInput, MAX_CYCLE_WEEKS, MAX_UPCOMING_CYCLES, NO_CYCLE_SCHEDULE } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@entwine/ui/components/ui/field";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";
import { SwitchField } from "@entwine/ui/components/ui/switch-field";
import { toast } from "@entwine/ui/components/ui/toast";
import { type ReactNode, useId } from "react";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "../../../../../../constants/cycle";
import { useAppForm } from "../../../../../../hooks/use-app-form";
import { submits } from "../../../../../../lib/form";
import type { Store } from "../../../../../../store";
import type { Project } from "../../../../../../types/rows";

/** What a schedule starts as when it is turned on: two weeks, a usual sprint. */
const DEFAULT_WEEKS = 2;

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const upTo = (max: number) => Array.from({ length: max }, (_, i) => i + 1);

function NumberSelect({
  name,
  value,
  options,
  disabled,
  onChange,
}: {
  name: string;
  value: number;
  options: { value: number; label: string }[];
  disabled: boolean;
  onChange(value: number): void;
}) {
  const label = options.find((option) => option.value === value)?.label;
  return (
    <Field>
      <FieldLabel>{name}</FieldLabel>
      <PropertySelect<number>
        label={`${name}: ${label}`}
        face="field"
        className="h-9 border"
        disabled={disabled}
        options={options}
        isSelected={(option) => option === value}
        onSelect={onChange}
      >
        {label}
      </PropertySelect>
    </Field>
  );
}

/**
 * The server creates the cycles and moves the issues, by the date in the schedule's time zone: the browser's, of
 * whoever saves it. Given a `key` of the project's schedule, so that a saved one is where the form starts again.
 */
export function CycleScheduleForm({ project, store }: { project: Project; store: Store }) {
  const frozen = project.archivedAt !== null;
  // A browser that will not say where it is plans by UTC.
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  // A schedule kept in another zone can be brought here with nothing else changed.
  const elsewhere = project.cycleWeeks !== null && project.cycleTimezone !== here;
  const form = useAppForm({
    defaultValues: {
      cycleWeeks: project.cycleWeeks,
      cycleStartDay: project.cycleStartDay,
      cycleUpcoming: project.cycleUpcoming,
      cycleRollover: project.cycleRollover,
      cycleTimezone: here,
    },
    validators: { onSubmit: cycleScheduleInput },
    onSubmit: ({ value }) => {
      // Without a schedule the rest is as a new project has it.
      void store.projects.update(project.id, value.cycleWeeks === null ? NO_CYCLE_SCHEDULE : value);
      toast.success(value.cycleWeeks === null ? "Cycle schedule turned off" : "Cycle schedule saved");
    },
  });
  return (
    <form.AppForm>
      <form onSubmit={submits(form)} className="rounded-xl border bg-card/40 p-5">
        <form.Subscribe selector={(state) => state.values.cycleWeeks}>
          {(weeks) => {
            const off = frozen || weeks === null;
            return (
              <FieldGroup>
                <form.Field name="cycleWeeks">
                  {(field) => (
                    <SwitchField
                      label="Create cycles automatically"
                      description="Cycles follow one another, each starting on the same weekday."
                      checked={weeks !== null}
                      disabled={frozen}
                      onChange={(on) => field.handleChange(on ? (project.cycleWeeks ?? DEFAULT_WEEKS) : null)}
                    />
                  )}
                </form.Field>
                <div className="grid gap-4 @min-[40rem]/main:grid-cols-3">
                  <form.Field name="cycleWeeks">
                    {(field) => (
                      <NumberSelect
                        name="Cycle length"
                        value={weeks ?? project.cycleWeeks ?? DEFAULT_WEEKS}
                        options={upTo(MAX_CYCLE_WEEKS).map((n) => ({ value: n, label: count(n, "week") }))}
                        disabled={off}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="cycleStartDay">
                    {(field) => (
                      <NumberSelect
                        name="Starts on"
                        value={field.state.value}
                        options={WEEKDAY_ORDER.map((day) => ({ value: day, label: WEEKDAY_LABELS[day] }))}
                        disabled={off}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                  <form.Field name="cycleUpcoming">
                    {(field) => (
                      <NumberSelect
                        name="Upcoming cycles"
                        value={field.state.value}
                        options={upTo(MAX_UPCOMING_CYCLES).map((n) => ({ value: n, label: count(n, "cycle") }))}
                        disabled={off}
                        onChange={field.handleChange}
                      />
                    )}
                  </form.Field>
                </div>
                <form.Field name="cycleRollover">
                  {(field) => (
                    <SwitchField
                      label="Roll over unfinished issues"
                      description="When a cycle ends, its issues that are not completed or cancelled move to the next cycle."
                      checked={field.state.value === 1}
                      disabled={off}
                      onChange={(on) => field.handleChange(on ? 1 : 0)}
                    />
                  )}
                </form.Field>
                <FieldDescription>
                  {elsewhere
                    ? `Cycles start and end by the date in ${project.cycleTimezone}. Saving changes it to your time zone, ${here}.`
                    : `Cycles start and end by the date in your time zone, ${here}.`}
                </FieldDescription>
              </FieldGroup>
            );
          }}
        </form.Subscribe>
        <div className="mt-6 flex justify-end">
          <form.Subscribe selector={(state) => state.isDirty}>
            {(dirty) => (
              <Button type="submit" disabled={frozen || !(dirty || elsewhere)}>
                Save schedule
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </form.AppForm>
  );
}

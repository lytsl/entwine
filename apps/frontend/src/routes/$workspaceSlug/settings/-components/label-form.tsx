import { labelInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { ColorPicker } from "@entwine/ui/components/ui/color-picker";
import { LABEL_COLORS } from "../../../../constants/label";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";
import { type Label } from "../../../../types/rows";

export function LabelForm({
  label,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label?: Label;
  submitLabel: string;
  /** Answers whether it saved; a form that made a label then takes the next one's name. */
  onSubmit(name: string, color: string): boolean;
  onCancel(): void;
}) {
  const form = useAppForm({
    defaultValues: { name: label?.name ?? "", color: label?.color ?? LABEL_COLORS[0] },
    validators: { onSubmit: labelInput },
    onSubmit: ({ value, formApi }) => {
      if (onSubmit(value.name.trim(), value.color)) formApi.setFieldValue("name", "");
    },
  });
  return (
    <form.AppForm>
      <form className="flex items-center gap-2 border-b bg-accent/30 px-4 py-2.5" onSubmit={submits(form)}>
        <form.Field name="color">
          {(field) => (
            <ColorPicker
              value={field.state.value}
              onChange={field.handleChange}
              colors={LABEL_COLORS}
              label="Label color"
            />
          )}
        </form.Field>
        <form.AppField name="name">
          {(field) => (
            <field.InlineTextField
              className="h-8 flex-1"
              placeholder="Label name"
              aria-label={label ? "Label name" : "New label"}
              autoFocus
              onKeyDown={(event) => event.key === "Escape" && onCancel()}
            />
          )}
        </form.AppField>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <form.SubmitButton size="sm">{submitLabel}</form.SubmitButton>
      </form>
    </form.AppForm>
  );
}

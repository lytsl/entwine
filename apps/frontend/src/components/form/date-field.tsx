import { DatePicker } from "@entwine/ui/components/ui/date-picker";
import { Field, FieldError, FieldLabel } from "@entwine/ui/components/ui/field";
import { cn } from "@entwine/ui/lib/utils";
import { useSelector } from "@tanstack/react-form";
import { useFieldContext } from "../../contexts/form";
import { fieldErrors } from "../../lib/form";

export function DateField({
  label,
  min,
  max,
  required,
}: {
  label: string;
  min?: string | null;
  max?: string | null;
  required: boolean;
}) {
  const field = useFieldContext<string | null>();
  const messages = fieldErrors(useSelector(field.store, (state) => state.meta.errors));
  return (
    <Field data-invalid={messages.length > 0}>
      <FieldLabel>{label}</FieldLabel>
      <div className={cn("rounded-md border", messages.length && "border-destructive")}>
        <DatePicker
          label={label}
          placeholder="Pick a date"
          value={field.state.value}
          onChange={field.handleChange}
          min={min}
          max={max}
          face="field"
          clearable={!required}
        />
      </div>
      <FieldError errors={messages} />
    </Field>
  );
}

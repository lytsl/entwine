import { Field, FieldError, FieldLabel } from "@entwine/ui/components/ui/field";
import { Input } from "@entwine/ui/components/ui/input";
import { Textarea } from "@entwine/ui/components/ui/textarea";
import { useSelector } from "@tanstack/react-form";
import type { ComponentProps, ReactNode } from "react";
import { useFieldContext } from "../../contexts/form";
import { fieldErrors } from "../../lib/form";

export function TextField({
  label,
  aside,
  multiline,
  ...props
}: {
  label: string;
  /** Beside the label, such as a link that helps with the field. */
  aside?: ReactNode;
  multiline?: boolean;
} & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const field = useFieldContext<string>();
  const errors = useSelector(field.store, (state) => state.meta.errors);
  const invalid = errors.length > 0;
  const errorId = `${field.name}-error`;
  const common = {
    id: field.name,
    value: field.state.value,
    onBlur: field.handleBlur,
    "aria-invalid": invalid,
    // So the message is read whenever the field is focused, not only once as an alert.
    "aria-describedby": invalid ? errorId : undefined,
  };
  return (
    <Field data-invalid={invalid}>
      {aside ? (
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          {aside}
        </div>
      ) : (
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      )}
      {multiline ? (
        <Textarea {...common} onChange={(e) => field.handleChange(e.target.value)} />
      ) : (
        <Input {...common} {...props} onChange={(e) => field.handleChange(e.target.value)} />
      )}
      <FieldError id={errorId} errors={fieldErrors(errors)} />
    </Field>
  );
}

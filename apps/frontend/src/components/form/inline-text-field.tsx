import { FieldError } from "@entwine/ui/components/ui/field";
import { Input } from "@entwine/ui/components/ui/input";
import { useSelector } from "@tanstack/react-form";
import { type ComponentProps, useId } from "react";
import { useFieldContext } from "../../contexts/form";
import { fieldErrors } from "../../lib/form";

/** For a form too small for labelled fields (a row or a card), where `aria-label` names the input. */
export function InlineTextField(props: Omit<ComponentProps<"input">, "id" | "value" | "onChange">) {
  const field = useFieldContext<string>();
  const errors = useSelector(field.store, (state) => state.meta.errors);
  const invalid = errors.length > 0;
  // Several of these forms can be on a page, each with a field of the same name.
  const errorId = `${useId()}-error`;
  return (
    <>
      <Input
        {...props}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      <FieldError id={errorId} className="text-caption whitespace-nowrap" errors={fieldErrors(errors)} />
    </>
  );
}

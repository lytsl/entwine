import { FieldError } from "@entwine/ui/components/ui/field";
import { useFormContext } from "../../contexts/form";

/** The submit validator's message; schema errors show on their fields instead. */
export function FormError() {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
      {(error) => (typeof error === "string" && error ? <FieldError>{error}</FieldError> : null)}
    </form.Subscribe>
  );
}

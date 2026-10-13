import { Button } from "@entwine/ui/components/ui/button";
import type { ComponentProps, ReactNode } from "react";
import { useFormContext } from "../../contexts/form";

/** `pending` is what the button says while the form submits. */
export function SubmitButton({
  children,
  pending = children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type" | "disabled"> & { pending?: ReactNode }) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(submitting) => (
        <Button type="submit" disabled={submitting} {...props}>
          {submitting ? pending : children}
        </Button>
      )}
    </form.Subscribe>
  );
}

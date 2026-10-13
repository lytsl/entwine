import { createFormHook } from "@tanstack/react-form";
import { DateField } from "../components/form/date-field";
import { FormError } from "../components/form/form-error";
import { InlineTextField } from "../components/form/inline-text-field";
import { SubmitButton } from "../components/form/submit-button";
import { TextField } from "../components/form/text-field";
import { fieldContext, formContext } from "../contexts/form";

/**
 * `form.AppField` renders `field.TextField`, `field.InlineTextField` or `field.DateField`; `form.FormError` and
 * `form.SubmitButton` go inside `form.AppForm`. A part of a form that is its own component is made with `withForm`.
 */
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, InlineTextField, DateField },
  formComponents: { FormError, SubmitButton },
});

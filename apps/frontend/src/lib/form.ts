import type { FormEvent } from "react";

/** Validation errors arrive as zod issues or strings; `FieldError` takes objects with a message. */
export const fieldErrors = (errors: unknown[]) =>
  errors.filter(Boolean).map((e) => (typeof e === "string" ? { message: e } : (e as { message?: string })));

/** A `<form>`'s `onSubmit` that keeps the submission from a form the dialog sits in. */
export const submits = (form: { handleSubmit(): Promise<unknown> }) => (event: FormEvent) => {
  event.preventDefault();
  event.stopPropagation();
  void form.handleSubmit();
};

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { FormField } from "@/components/form/form-field";
import { InputField } from "@/components/form/input.field";
import { SubmitButton } from "@/components/form/submit-button";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
	createFormHookContexts();

const formHook = createFormHook({
	fieldContext,
	formContext,
	fieldComponents: { FormField, Input: InputField },
	formComponents: { SubmitButton },
});

export const { useAppForm, withForm } = formHook;

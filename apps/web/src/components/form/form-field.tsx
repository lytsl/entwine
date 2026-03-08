import type React from "react";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { useFieldContext } from "@/hooks/form";
import {
	type FormFieldProps,
	type FormFieldSlotProps,
	useFormField,
} from "@/hooks/use-form-field";

export const FormField = <T = unknown>({
	children,
	...formFieldProps
}: FormFieldProps & {
	children: (props: FormFieldSlotProps<T>) => React.ReactElement;
}) => {
	const field = useFieldContext<T>();
	const { label, description, errors, childrenProps } = useFormField<T>({
		...formFieldProps,
		field,
	});

	return (
		<Field data-invalid={childrenProps["aria-invalid"]}>
			{label && <FieldLabel htmlFor={childrenProps.id}>{label}</FieldLabel>}
			{children(childrenProps)}
			{childrenProps["aria-invalid"] ? (
				<FieldError id={childrenProps["aria-errormessage"]} errors={errors} />
			) : description ? (
				<FieldDescription id={childrenProps["aria-describedby"]}>
					{description}
				</FieldDescription>
			) : null}
		</Field>
	);
};

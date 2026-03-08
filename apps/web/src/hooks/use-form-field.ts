import type { MergeType } from "@entwine/utility/types";
import type { FieldApi } from "@tanstack/react-form";
import { useId } from "react";

type FormFieldValueProps<T = unknown> = {
	name: string;
	defaultValue?: T | undefined;
	value?: T | undefined;
	onValueChange?: (v: T) => void;
};

export type FormFieldProps = {
	controlled?: boolean;
	label?: string;
	description?: string;
};

export type FormFieldSlotProps<
	T = unknown,
	C = React.HTMLAttributes<HTMLElement>,
> = MergeType<C, FormFieldValueProps<T>> & { placeholder?: string | undefined };

export type FieldApiType<T> = FieldApi<
	any,
	any,
	T,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any,
	any
>;

export const useFormField = <T = unknown>({
	controlled = true,
	label,
	description,
	field,
}: FormFieldProps & {
	field: FieldApiType<T>;
}) => {
	const isError = field.state.meta.errors.length > 0;

	const id = useId();
	const inputId = `${field.name}_input_${id}`;
	const errorId = isError ? `${field.name}_error_${id}` : undefined;
	const descriptionId =
		!isError && description ? `${field.name}_description_${id}` : undefined;

	const childrenProps = {
		id: inputId,
		name: field.name,
		value: controlled ? field.state.value : undefined,
		defaultValue: controlled ? undefined : field.state.value,
		onValueChange: (value: T) => {
			field.handleChange(value);
		},
		onBlur: () => {
			field.handleBlur();
		},
		"aria-invalid": isError,
		"aria-errormessage": errorId,
		"aria-describedby": descriptionId,
	} satisfies FormFieldSlotProps<T>;

	console.log(inputId, field.state.meta.errors);

	return {
		label,
		description,
		errors: field.state.meta.errors,
		childrenProps,
	};
};

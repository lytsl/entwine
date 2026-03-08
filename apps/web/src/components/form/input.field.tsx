import type { RequiredUndefined } from "@entwine/utility/types";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "./form-field";

type FormFieldProps = Omit<
	ComponentProps<typeof FormField<string>>,
	"children"
>;

export const InputField = ({
	controlled,
	label,
	description,
	onChange,
	...props
}: ComponentProps<typeof Input> & FormFieldProps) => {
	const formFieldProps: RequiredUndefined<FormFieldProps> = {
		controlled,
		label,
		description,
	};
	return (
		<FormField<string>
			{...formFieldProps}
			children={({ onValueChange, ...formFieldInputProps }) => (
				<Input
					onChange={(e) => {
						onChange?.(e);
						return onValueChange?.(e.target.value);
					}}
					{...formFieldInputProps}
					{...props}
				/>
			)}
		/>
	);
};

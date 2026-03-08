import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useFormContext } from "@/hooks/form";

export function SubmitButton({
	disabled,
	...props
}: ComponentProps<typeof Button>) {
	const form = useFormContext();
	return (
		<form.Subscribe selector={(state) => state.isSubmitting}>
			{(isSubmitting) => (
				<Button type="submit" disabled={disabled || isSubmitting} {...props} />
			)}
		</form.Subscribe>
	);
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type } from "arktype";
import { GalleryVerticalEnd } from "lucide-react";
import { toast } from "sonner";
import Loader from "@/components/layout/loader";
import { Button } from "@/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAppForm } from "@/hooks/form";
import { type FieldApiType, useFormField } from "@/hooks/use-form-field";
import { authClient } from "@/lib/auth-client";
import { focusInvalidFormField } from "@/utils/form";

export const Route = createFileRoute("/(auth)/login")({
	component: RouteComponent,
});
const onSubmitValidation = type({
	email: "string.email",
	password: "string >= 8",
});

function RouteComponent() {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useAppForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/$orgId",
							params: { orgId: "org1" },
						});
						toast.success("Sign in successful");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		onSubmitInvalid(props) {
			focusInvalidFormField(props.formApi.formId);
		},
		validators: {
			onSubmit: onSubmitValidation,
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="flex min-h-svh flex-col gap-4 p-6 md:p-10">
			<div className="flex justify-center gap-2 md:justify-start">
				<a href="#" className="flex items-center gap-2 font-medium">
					<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<GalleryVerticalEnd className="size-4" />
					</div>
					Acme Inc.
				</a>
			</div>
			<div className="flex flex-1 items-center justify-center">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="w-full max-w-xs"
				>
					<FieldGroup>
						<div className="flex flex-col items-center gap-1 text-center">
							<h1 className="font-bold text-2xl">Login to your account</h1>
							<p className="text-balance text-muted-foreground text-sm">
								Enter your email below to login to your account
							</p>
						</div>
						<form.AppField
							name="email"
							children={(field) => (
								<field.Input label="Email" placeholder="Enter your email" />
							)}
						/>
						<form.Field
							name="password"
							children={(field) => <LoginPasswordField field={field} />}
						/>
						<Field>
							<Button type="submit">Login</Button>
						</Field>

						<Field>
							<FieldDescription className="text-center">
								Don&apos;t have an account?{" "}
								<Link to="/signup" className="underline underline-offset-4">
									Sign up
								</Link>
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</div>
		</div>
	);
}

function LoginPasswordField({ field }: { field: FieldApiType<string> }) {
	const { label, errors, childrenProps } = useFormField({
		field,
		label: "Password",
	});

	return (
		<Field data-invalid={childrenProps["aria-invalid"]}>
			<div className="flex items-center">
				<FieldLabel htmlFor={childrenProps.id}>{label}</FieldLabel>
				<a
					href="#"
					className="ml-auto inline-block text-card-foreground text-sm underline-offset-4 hover:underline"
				>
					Forgot your password?
				</a>
			</div>
			<Input
				{...childrenProps}
				type="password"
				placeholder="Enter your password"
			/>
			{childrenProps["aria-invalid"] ? (
				<FieldError id={childrenProps["aria-errormessage"]} errors={errors} />
			) : null}
		</Field>
	);
}

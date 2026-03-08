import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type } from "arktype";
import { toast } from "sonner";
import Loader from "@/components/layout/loader";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { useAppForm } from "@/hooks/form";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { focusInvalidFormField } from "@/utils/form";

export const Route = createFileRoute("/(auth)/signup")({
	component: RouteComponent,
});
const onSubmitValidation = type({
	email: "string.email",
	password: "string >= 8",
	confirmPassword: "string >= 8",
}).narrow((data, ctx) => {
	if (data.password === data.confirmPassword) {
		return true;
	}
	return ctx.reject({
		expected: "identical to password",
		// don't display the password in the error message!
		actual: "",
		path: ["confirmPassword"],
	});
});

function RouteComponent({ className, ...props }: React.ComponentProps<"div">) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useAppForm({
		defaultValues: {
			email: "",
			password: "",
			confirmPassword: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					name: value.email,
					email: value.email,
					password: value.password,
				},
				{
					onSuccess: () => {
						navigate({
							to: "/join",
						});
						toast.success("Sign up successful");
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
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-sm">
				<div className={cn("flex flex-col gap-6", className)} {...props}>
					<Card>
						<CardHeader>
							<CardTitle>Create an account</CardTitle>
							<CardDescription>
								Enter your information below to create your account
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form
								onSubmit={(e) => {
									e.preventDefault();
									e.stopPropagation();
									form.handleSubmit();
								}}
							>
								<FieldGroup>
									<form.AppField
										name="email"
										children={(field) => (
											<field.Input
												label="Email"
												placeholder="Enter your email address"
												type="email"
											/>
										)}
									/>
									<form.AppField
										name="password"
										children={(field) => (
											<field.Input
												label="Password"
												placeholder="Enter your password"
												type="password"
											/>
										)}
									/>
									<form.AppField
										name="confirmPassword"
										children={(field) => (
											<field.Input
												label="Confirm Password"
												placeholder="Confirm your password"
												type="password"
											/>
										)}
									/>

									<Field>
										<Button type="submit">Create Account</Button>
										{/* <Button variant="outline" type="button">
											Login with Google
										</Button> */}
										<FieldDescription className="text-center">
											Already have an account? <Link to="/login">Sign In</Link>
										</FieldDescription>
									</Field>
								</FieldGroup>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

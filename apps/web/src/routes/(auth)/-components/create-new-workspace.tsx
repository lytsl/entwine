import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type } from "arktype";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { useAppForm } from "@/hooks/form";
import { type FieldApiType, useFormField } from "@/hooks/use-form-field";
import { authClient } from "@/lib/auth-client";
import { focusInvalidFormField } from "@/utils/form";
import { Route } from "../_auth";

type ViewVariant = "onboarding" | "join";

interface CreateWorkspaceProps {
	variant: ViewVariant;
	userEmail?: string;
}

const onSubmitValidation = type({
	name: "string >= 3",
	slug: type(/^[a-z0-9-]+$/).configure({
		message: "invalid format, can only contain letters, numbers, and dashes",
	}),
});

const WorkspaceForm = () => {
	const navigate = useNavigate({
		from: "/",
	});

	const form = useAppForm({
		defaultValues: {
			name: "",
			slug: "",
		},
		onSubmit: async ({ value }) => {
			authClient.organization.create(value, {
				onSuccess: () => {
					navigate({ to: "/$orgId", params: { orgId: value.slug } });
				},
				onError: (error) => {
					toast.error(error.error.message || error.error.statusText);
				},
			});
		},
		onSubmitInvalid(props) {
			focusInvalidFormField(props.formApi.formId);
		},
		validators: {
			onSubmit: onSubmitValidation,
		},
	});

	return (
		<div className="w-md max-w-[90vw] space-y-6">
			<div className="flex flex-col items-center gap-6 text-center">
				<h1 className="font-medium text-2xl">Create a new workspace</h1>
				<p className="text-base text-muted-foreground">
					Workspaces are shared environments where teams can work on projects,
					cycles and issues.
				</p>
			</div>

			<Card className="mt-2" size="lg">
				<CardContent>
					<form
						id={form.formId}
						onSubmit={(e) => {
							e.preventDefault();
							e.stopPropagation();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
							<form.AppField
								listeners={{
									onChange: (field) => {
										if (!form.getFieldMeta("slug")?.isBlurred) {
											form.setFieldValue(
												"slug",
												field.value.toLowerCase().replaceAll(/[^a-z0-9]/g, "-"),
											);
										}
									},
								}}
								name="name"
								children={(field) => (
									<field.Input label="Workspace Name" size={"xl"} />
								)}
							/>

							<form.Field
								name="slug"
								validators={{
									onChangeAsyncDebounceMs: 500,
									onChangeAsync: async (field) => {
										const slugRes = await authClient.organization.checkSlug({
											slug: field.value,
										});
										if (!slugRes.data?.status) {
											return {
												message: "This workspace URL is already taken.",
											};
										}
									},
								}}
								children={(field) => <UrlField field={field} />}
							/>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
			<Field className="mx-auto w-80 gap-6">
				<Button form={form.formId} type="submit" size={"xl"} className={""}>
					Create Workspace
				</Button>
				<Button variant="ghost" type="button">
					Join existing workspace instead
				</Button>
			</Field>
		</div>
	);
};

function UrlField({ field }: { field: FieldApiType<string> }) {
	const { label, errors, childrenProps } = useFormField({
		field,
		label: "Workspace URL",
	});

	return (
		<Field data-invalid={childrenProps["aria-invalid"]}>
			<FieldLabel htmlFor={childrenProps.id}>{label}</FieldLabel>

			<InputGroup className="h-auto">
				<InputGroupAddon>
					<InputGroupText>linear.app/</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput className="!pl-0.5" size={"xl"} {...childrenProps} />
			</InputGroup>
			{childrenProps["aria-invalid"] ? (
				<FieldError id={childrenProps["aria-errormessage"]} errors={errors} />
			) : null}
		</Field>
	);
}

const UserDropdown = () => {
	const isMobile = false;

	const sessionQuery = useSuspenseQuery({
		queryKey: ["authClient.multiSession.listDeviceSessions"],
		queryFn: () => authClient.multiSession.listDeviceSessions(),
	});
	const { session } = Route.useRouteContext();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button className={"h-auto p-2.5"} variant={"ghost"} />}
			>
				<div className="flex flex-1 flex-col gap-1 text-left">
					<div className="truncate text-muted-foreground text-xs">
						Logged in as
					</div>
					<div className="truncate text-sm">{session?.data?.user?.email}</div>
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
				side={isMobile ? "bottom" : "right"}
				align="end"
				sideOffset={4}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel>Accounts</DropdownMenuLabel>
					{sessionQuery.data.data?.map((d) => (
						<DropdownMenuCheckboxItem
							key={d.user.email}
							checked={d.user.email === session?.data?.user?.email}
							onCheckedChange={(v) => {
								if (v && d.user.email !== session?.data?.user?.email) {
									authClient.multiSession.setActive({
										sessionToken: d.session.token,
									});
								}
							}}
						>
							{d.user.email}
						</DropdownMenuCheckboxItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />

				<DropdownMenuGroup>
					<DropdownMenuItem>Add an account</DropdownMenuItem>
					<DropdownMenuItem>Log out</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

export default function CreateWorkspaceScreen({
	variant = "onboarding", // Default to '/' behavior
	userEmail = "user@example.com",
}: CreateWorkspaceProps) {
	const invitationsListQuery = useSuspenseQuery({
		queryKey: ["authClient.organization.listInvitations"],
		queryFn: () => authClient.organization.listInvitations(),
	});

	return (
		<div className="flex min-h-svh flex-col gap-4 p-4 md:p-6">
			<div className="flex items-start justify-between gap-2">
				{variant === "join" ? (
					<Button variant="ghost">
						<ChevronLeft className="h-4 w-4" />
						Back to Linear
					</Button>
				) : (
					<Button variant="ghost">Log out</Button>
				)}

				<UserDropdown />
			</div>

			<div className="flex flex-1 items-center justify-center">
				{invitationsListQuery.data.data?.length ? (
					<div>
						{invitationsListQuery.data.data.map((invitation) => (
							<div key={invitation.id}>{invitation.id}</div>
						))}
					</div>
				) : (
					<WorkspaceForm />
				)}
			</div>
		</div>
	);
}

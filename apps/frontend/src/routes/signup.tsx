import { signUpInput } from "@entwine/shared";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AuthCard } from "../components/auth-card";
import { useAppForm } from "../hooks/use-app-form";
import { submits } from "../lib/form";
import { nextSearch } from "../lib/url";
import { authClient, errorMessage } from "../services/auth-client";

export const Route = createFileRoute("/signup")({
  validateSearch: nextSearch,
  component: SignupPage,
});

function SignupPage() {
  const router = useRouter();
  const { next, email } = Route.useSearch();
  const { queryClient } = Route.useRouteContext();
  const form = useAppForm({
    defaultValues: { name: "", email: email ?? "", password: "" },
    validators: {
      onSubmit: signUpInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await authClient.signUp.email({
            name: value.name.trim(),
            email: value.email.trim(),
            password: value.password,
            // Where the verification link the server mails lands.
            callbackURL: "/",
          });
        } catch (error) {
          return errorMessage(error);
        }
      },
    },
    onSubmit: () => {
      queryClient.clear();
      router.history.push(next);
    },
  });

  return (
    <AuthCard title="Create your account" description="Then create a workspace or accept an invitation.">
      <form.AppForm>
        <form onSubmit={submits(form)}>
          <CardContent>
            <FieldGroup>
              <form.AppField name="name">
                {(field) => <field.TextField label="Name" autoComplete="name" autoFocus />}
              </form.AppField>
              <form.AppField name="email">
                {(field) => <field.TextField label="Email" type="email" autoComplete="email" />}
              </form.AppField>
              <form.AppField name="password">
                {(field) => <field.TextField label="Password" type="password" autoComplete="new-password" />}
              </form.AppField>
              <form.FormError />
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3">
            <form.SubmitButton className="w-full" pending="Creating account…">
              Sign up
            </form.SubmitButton>
            <p className="text-xs text-muted-foreground">
              Have an account?{" "}
              <Link to="/login" search={{ next, email }} className="text-foreground underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </form.AppForm>
    </AuthCard>
  );
}

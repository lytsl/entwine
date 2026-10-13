import { signInInput } from "@entwine/shared";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AuthCard } from "../components/auth-card";
import { useAppForm } from "../hooks/use-app-form";
import { submits } from "../lib/form";
import { nextSearch } from "../lib/url";
import { authClient, errorMessage } from "../services/auth-client";

export const Route = createFileRoute("/login")({
  validateSearch: nextSearch,
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { next, email } = Route.useSearch();
  const { queryClient } = Route.useRouteContext();
  const form = useAppForm({
    defaultValues: { email: email ?? "", password: "" },
    validators: {
      onSubmit: signInInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await authClient.signIn.email({ email: value.email.trim(), password: value.password });
        } catch (error) {
          return errorMessage(error);
        }
      },
    },
    onSubmit: () => {
      queryClient.clear();
      // `next` is a whole address, search included, which `navigate` would take for a path.
      router.history.push(next);
    },
  });

  return (
    <AuthCard title="Sign in" description="Welcome back to your workspaces.">
      <form.AppForm>
        <form onSubmit={submits(form)}>
          <CardContent>
            <FieldGroup>
              <form.AppField name="email">
                {(field) => <field.TextField label="Email" type="email" autoComplete="email" autoFocus />}
              </form.AppField>
              <form.AppField name="password">
                {(field) => (
                  <field.TextField
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    aside={
                      <form.Subscribe selector={(state) => state.values.email.trim()}>
                        {(email) => (
                          <Link
                            to="/forgot-password"
                            search={{ email }}
                            className="text-caption text-muted-foreground underline underline-offset-4 hover:text-foreground"
                          >
                            Forgot password?
                          </Link>
                        )}
                      </form.Subscribe>
                    }
                  />
                )}
              </form.AppField>
              <form.FormError />
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3">
            <form.SubmitButton className="w-full" pending="Signing in…">
              Sign in
            </form.SubmitButton>
            <p className="text-xs text-muted-foreground">
              No account?{" "}
              <Link to="/signup" search={{ next, email }} className="text-foreground underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </form.AppForm>
    </AuthCard>
  );
}

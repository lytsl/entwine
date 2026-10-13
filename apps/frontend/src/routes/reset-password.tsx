import { resetPasswordInput } from "@entwine/shared";
import { buttonVariants } from "@entwine/ui/components/ui/button";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthCard } from "../components/auth-card";
import { useAppForm } from "../hooks/use-app-form";
import { submits } from "../lib/form";
import { authClient, errorCode, errorMessage } from "../services/auth-client";

/** The mailed link comes here with its `token`, or with an `error` when Better Auth found it used or expired. */
export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({
    token: z.string().optional().catch(undefined),
    error: z.string().optional().catch(undefined),
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  const [expired, setExpired] = useState(!token || Boolean(error));
  const [done, setDone] = useState(false);
  const form = useAppForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    validators: {
      onSubmit: resetPasswordInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await authClient.resetPassword({ newPassword: value.newPassword, token });
        } catch (failure) {
          if (errorCode(failure) !== "INVALID_TOKEN") return errorMessage(failure);
          setExpired(true);
          return "This link has expired";
        }
      },
    },
    onSubmit: () => setDone(true),
  });

  if (done)
    return (
      <AuthCard
        title="Password updated"
        description={<span role="status">Every session was signed out. Sign in with your new password.</span>}
      >
        <CardFooter>
          <Link to="/login" search={{ next: "/" }} className={buttonVariants({ className: "w-full" })}>
            Sign in
          </Link>
        </CardFooter>
      </AuthCard>
    );
  if (expired)
    return (
      <AuthCard
        title="This link has expired"
        description={<span role="alert">A reset link works once, within an hour. Ask for a new one to continue.</span>}
      >
        <CardFooter className="flex-col gap-3">
          <Link to="/forgot-password" search={{ email: "" }} className={buttonVariants({ className: "w-full" })}>
            Request a new link
          </Link>
          <Link
            to="/login"
            search={{ next: "/" }}
            className={buttonVariants({ variant: "ghost", className: "w-full" })}
          >
            Back to sign in
          </Link>
        </CardFooter>
      </AuthCard>
    );
  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters. Every device will be signed out.">
      <form.AppForm>
        <form onSubmit={submits(form)}>
          <CardContent>
            <FieldGroup>
              <form.AppField name="newPassword">
                {(field) => (
                  <field.TextField label="New password" type="password" autoComplete="new-password" autoFocus />
                )}
              </form.AppField>
              <form.AppField name="confirmPassword">
                {(field) => (
                  <field.TextField label="Confirm new password" type="password" autoComplete="new-password" />
                )}
              </form.AppField>
              <form.FormError />
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3">
            <form.SubmitButton className="w-full" pending="Updating…">
              Update password
            </form.SubmitButton>
            <p className="text-xs text-muted-foreground">
              Changed your mind?{" "}
              <Link to="/login" search={{ next: "/" }} className="text-foreground underline underline-offset-4">
                Back to sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </form.AppForm>
    </AuthCard>
  );
}

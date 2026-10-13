import { forgotPasswordInput } from "@entwine/shared";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthCard } from "../components/auth-card";
import { useAppForm } from "../hooks/use-app-form";
import { submits } from "../lib/form";
import { authClient, errorMessage } from "../services/auth-client";
import { configQuery } from "../services/queries";
import { ResetLinkSent } from "./-components/reset-link-sent";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: z.object({ email: z.string().catch("").default("") }),
  component: ForgotPasswordPage,
});

const requestReset = (email: string) => authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });

const backToSignIn = (
  <p className="text-xs text-muted-foreground">
    Remembered it?{" "}
    <Link to="/login" search={{ next: "/" }} className="text-foreground underline underline-offset-4">
      Sign in
    </Link>
  </p>
);

function ForgotPasswordPage() {
  const config = useQuery(configQuery).data;
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: { email: Route.useSearch().email },
    validators: {
      onSubmit: forgotPasswordInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await requestReset(value.email.trim());
        } catch (error) {
          return errorMessage(error);
        }
      },
    },
    onSubmit: ({ value }) => setSentTo(value.email.trim()),
  });

  if (config && !config.mail)
    return (
      <AuthCard
        title="Reset your password"
        description={
          <span role="status">
            This server sends no mail, so it cannot send you a link to reset your password. Ask the person who runs it.
          </span>
        }
      >
        <CardFooter>{backToSignIn}</CardFooter>
      </AuthCard>
    );
  if (sentTo) return <ResetLinkSent email={sentTo} onAgain={requestReset} />;
  return (
    <AuthCard title="Reset your password" description="Enter your email and we'll send you a link to set a new one.">
      <form.AppForm>
        <form onSubmit={submits(form)}>
          <CardContent>
            <FieldGroup>
              <form.AppField name="email">
                {(field) => <field.TextField label="Email" type="email" autoComplete="email" autoFocus />}
              </form.AppField>
              <form.FormError />
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-3">
            <form.SubmitButton className="w-full" pending="Sending…">
              Send reset link
            </form.SubmitButton>
            {backToSignIn}
          </CardFooter>
        </form>
      </form.AppForm>
    </AuthCard>
  );
}

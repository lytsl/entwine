import { passwordInput } from "@entwine/shared";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { toast } from "@entwine/ui/components/ui/toast";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";
import { authClient, errorCode, errorMessage } from "../../../../services/auth-client";

export function PasswordForm() {
  const form = useAppForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: {
      onSubmit: passwordInput,
      onSubmitAsync: async ({ value }) => {
        try {
          // The server ends the other sessions whatever is asked; this says what the form does.
          const { currentPassword, newPassword } = value;
          await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
        } catch (error) {
          const wrong = errorCode(error) === "INVALID_PASSWORD";
          return wrong ? "The current password is wrong" : errorMessage(error);
        }
      },
    },
    onSubmit: ({ formApi }) => {
      formApi.reset();
      toast.success("Password changed", { description: "Your other sessions were signed out." });
    },
  });
  return (
    <form.AppForm>
      <form onSubmit={submits(form)}>
        <FieldGroup>
          <form.AppField name="currentPassword">
            {(field) => <field.TextField label="Current password" type="password" autoComplete="current-password" />}
          </form.AppField>
          <form.AppField name="newPassword">
            {(field) => <field.TextField label="New password" type="password" autoComplete="new-password" />}
          </form.AppField>
          <form.AppField name="confirmPassword">
            {(field) => <field.TextField label="Confirm new password" type="password" autoComplete="new-password" />}
          </form.AppField>
          <form.FormError />
        </FieldGroup>
        <div className="mt-6 flex">
          <form.SubmitButton pending="Changing…">Change password</form.SubmitButton>
        </div>
      </form>
    </form.AppForm>
  );
}

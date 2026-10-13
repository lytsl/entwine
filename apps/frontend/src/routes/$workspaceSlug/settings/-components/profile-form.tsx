import { profileInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@entwine/ui/components/ui/field";
import { Input } from "@entwine/ui/components/ui/input";
import { toast } from "@entwine/ui/components/ui/toast";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";
import { authClient, errorMessage } from "../../../../services/auth-client";
import type { Member } from "../../../../types/rows";

/** Keyed by the name: the form starts again once the member directory has the new one. */
export function ProfileForm({ member, onChangeEmail }: { member: Member; onChangeEmail(): void }) {
  const form = useAppForm({
    defaultValues: { name: member.name },
    validators: {
      onSubmit: profileInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await authClient.updateUser({ name: value.name.trim() });
        } catch (error) {
          return errorMessage(error);
        }
      },
    },
    onSubmit: () => void toast.success("Profile saved"),
  });
  return (
    <form.AppForm>
      <form onSubmit={submits(form)}>
        <FieldGroup>
          <form.AppField name="name">{(field) => <field.TextField label="Name" autoComplete="name" />}</form.AppField>
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="profile-email"
                type="email"
                readOnly
                value={member.email}
                aria-describedby="profile-email-note"
                className="text-muted-foreground"
              />
              <Button type="button" variant="outline" onClick={onChangeEmail}>
                Change email
              </Button>
            </div>
            <FieldDescription id="profile-email-note">
              You sign in with it, and notifications are mailed to it.
            </FieldDescription>
          </Field>
          <form.FormError />
        </FieldGroup>
        <div className="mt-6 flex">
          {/* Surrounding spaces are no change: the server trims the name. */}
          <form.Subscribe selector={(state) => [state.values.name.trim() !== member.name, state.isSubmitting]}>
            {([changed, submitting]) => (
              <Button type="submit" disabled={!changed || submitting}>
                Save changes
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </form.AppForm>
  );
}

import { inviteInput, type Role } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@entwine/ui/components/ui/field";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";
import { RolePicker } from "./role-picker";

export function InviteDialog({
  roles,
  onClose,
  onInvite,
}: {
  roles: Role[];
  onClose(): void;
  onInvite(email: string, role: Role): void;
}) {
  const form = useAppForm({
    defaultValues: { email: "", role: "member" as Role },
    validators: { onSubmit: inviteInput },
    onSubmit: ({ value }) => onInvite(value.email.trim(), value.role),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>They join the workspace with the role you choose when they accept.</DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form onSubmit={submits(form)}>
            <FieldGroup>
              <div className="grid grid-cols-[1fr_9rem] gap-3">
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      label="Email"
                      type="email"
                      required
                      autoFocus
                      placeholder="name@example.com"
                      aria-label="Email to invite"
                    />
                  )}
                </form.AppField>
                <form.Field name="role">
                  {(field) => (
                    <Field>
                      <FieldLabel>Role</FieldLabel>
                      <RolePicker
                        roles={roles}
                        value={field.state.value}
                        onChange={field.handleChange}
                        label={`Role: ${field.state.value}`}
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
            </FieldGroup>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <form.SubmitButton>Invite</form.SubmitButton>
            </div>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}

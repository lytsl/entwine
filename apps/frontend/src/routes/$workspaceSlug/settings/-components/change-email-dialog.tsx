import { changeEmailInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { toast } from "@entwine/ui/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";
import { authClient, errorMessage } from "../../../../services/auth-client";
import { sessionQuery } from "../../../../services/queries";

/**
 * A verified address changes only once its holder confirms from it, then the new one is verified; an unverified one
 * changes at once. An address another account uses is answered as any other, so the form cannot tell.
 */
export function ChangeEmailDialog({ email, verified, onClose }: { email: string; verified: boolean; onClose(): void }) {
  const queryClient = useQueryClient();
  const form = useAppForm({
    defaultValues: { email: "" },
    validators: {
      onSubmit: changeEmailInput,
      onSubmitAsync: async ({ value }) => {
        if (value.email.trim().toLowerCase() === email) return "This is your address already";
        try {
          await authClient.changeEmail({ newEmail: value.email.trim(), callbackURL: "/" });
        } catch (error) {
          return errorMessage(error);
        }
      },
    },
    onSubmit: async ({ value }) => {
      const newEmail = value.email.trim().toLowerCase();
      const session = await queryClient.fetchQuery({ ...sessionQuery, staleTime: 0 });
      if (session?.user.email === newEmail) toast.success(`Your address is now ${newEmail}`);
      else if (verified)
        toast.success(`Check ${email}`, {
          description: `Confirm the change there, then open the link sent to ${newEmail}.`,
        });
      else toast.error(`${newEmail} cannot be used. Choose another address.`);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            {verified
              ? `To be sure it is you, ${email} is sent a link to confirm the change first.`
              : "You sign in with the new address from now on."}
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form onSubmit={submits(form)}>
            <FieldGroup>
              <form.AppField name="email">
                {(field) => <field.TextField label="New email" type="email" autoComplete="email" autoFocus />}
              </form.AppField>
              <form.FormError />
            </FieldGroup>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <form.SubmitButton pending="Sending…">Continue</form.SubmitButton>
            </div>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}

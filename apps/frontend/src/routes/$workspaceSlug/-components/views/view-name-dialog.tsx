import { viewNameInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@entwine/ui/components/ui/dialog";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import type { ReactNode } from "react";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";

export function ViewNameDialog({
  title,
  description,
  submitLabel,
  initialName = "",
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  description?: string;
  submitLabel: string;
  initialName?: string;
  onClose(): void;
  onSubmit(name: string): void;
  children?: ReactNode;
}) {
  const form = useAppForm({
    defaultValues: { name: initialName },
    validators: { onSubmit: viewNameInput },
    onSubmit: ({ value }) => {
      onSubmit(value.name.trim());
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form.AppForm>
          <form onSubmit={submits(form)}>
            <FieldGroup>
              <form.AppField name="name">
                {(field) => <field.TextField label="View name" autoFocus placeholder="Urgent bugs" />}
              </form.AppField>
              {children}
            </FieldGroup>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <form.SubmitButton>{submitLabel}</form.SubmitButton>
            </div>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}

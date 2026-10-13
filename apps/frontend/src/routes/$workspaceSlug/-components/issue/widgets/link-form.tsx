import { issueLinkInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { useAppForm } from "../../../../../hooks/use-app-form";
import { submits } from "../../../../../lib/form";
import type { IssueLink } from "../../../../../types/rows";

export function LinkForm({
  link,
  onSave,
  onCancel,
}: {
  link?: IssueLink;
  onSave(value: { url: string; title: string }): void;
  onCancel(): void;
}) {
  const form = useAppForm({
    defaultValues: { url: link?.url ?? "", title: link?.title ?? "" },
    validators: { onSubmit: issueLinkInput },
    onSubmit: ({ value }) => onSave(value),
  });
  return (
    <form.AppForm>
      <form className="mt-1 flex flex-col gap-2 rounded-lg border bg-card p-3" onSubmit={submits(form)}>
        <form.AppField name="url">
          {(field) => <field.InlineTextField autoFocus aria-label="URL" placeholder="https://…" />}
        </form.AppField>
        <form.AppField name="title">
          {(field) => <field.InlineTextField aria-label="Link title" placeholder="Title (optional)" />}
        </form.AppField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <form.SubmitButton size="sm">{link ? "Save link" : "Add link"}</form.SubmitButton>
        </div>
      </form>
    </form.AppForm>
  );
}

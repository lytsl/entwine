import { workspaceRenameInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@entwine/ui/components/ui/field";
import { Input } from "@entwine/ui/components/ui/input";
import { toast } from "@entwine/ui/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAppForm } from "../../../../hooks/use-app-form";
import { submits } from "../../../../lib/form";
import { authClient, errorMessage, type WorkspaceInfo } from "../../../../services/auth-client";
import { workspacesQuery } from "../../../../services/queries";

/** Keyed by the name: a rename made elsewhere starts the form again. */
export function WorkspaceNameForm({ workspace, editable }: { workspace: WorkspaceInfo; editable: boolean }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const form = useAppForm({
    defaultValues: { name: workspace.name },
    validators: {
      onSubmit: workspaceRenameInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await authClient.organization.update({ organizationId: workspace.id, data: { name: value.name.trim() } });
        } catch (error) {
          return errorMessage(error);
        }
      },
    },
    onSubmit: async () => {
      // The pages read the name from the list the route holds.
      await queryClient.invalidateQueries({ queryKey: workspacesQuery.queryKey });
      await router.invalidate();
      toast.success("Workspace renamed");
    },
  });
  return (
    <form.AppForm>
      <form onSubmit={submits(form)}>
        <FieldGroup>
          <form.AppField name="name">
            {(field) => <field.TextField label="Name" disabled={!editable} autoComplete="off" />}
          </form.AppField>
          <Field>
            <FieldLabel htmlFor="workspace-url">URL</FieldLabel>
            <Input
              id="workspace-url"
              readOnly
              value={`${window.location.host}/${workspace.slug}`}
              aria-describedby="workspace-url-note"
              className="text-muted-foreground"
            />
            <FieldDescription id="workspace-url-note">
              The URL cannot be changed: links, bookmarks and invitations hold it.
            </FieldDescription>
          </Field>
          <form.FormError />
        </FieldGroup>
        {editable ? (
          <div className="mt-6 flex">
            {/* Surrounding spaces are no change: the server trims the name. */}
            <form.Subscribe selector={(state) => [state.values.name.trim() !== workspace.name, state.isSubmitting]}>
              {([changed, submitting]) => (
                <Button type="submit" disabled={!changed || submitting}>
                  Save changes
                </Button>
              )}
            </form.Subscribe>
          </div>
        ) : (
          <p className="mt-6 text-body text-muted-foreground">Only owners and admins can rename the workspace.</p>
        )}
      </form>
    </form.AppForm>
  );
}

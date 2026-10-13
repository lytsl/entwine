import { workspaceInput } from "@entwine/shared";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "../components/auth-card";
import { useAppForm } from "../hooks/use-app-form";
import { submits } from "../lib/form";
import { slugify } from "../lib/suggest";
import { authClient, errorCode, errorMessage } from "../services/auth-client";
import { requireSession } from "../services/guards";
import { workspacesQuery } from "../services/queries";

export const Route = createFileRoute("/new")({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location.href),
  component: NewWorkspacePage,
});

function NewWorkspacePage() {
  const navigate = Route.useNavigate();
  const { queryClient } = Route.useRouteContext();
  const form = useAppForm({
    defaultValues: { name: "", slug: "" },
    validators: {
      onSubmit: workspaceInput,
      onSubmitAsync: async ({ value }) => {
        try {
          await authClient.organization.create({ name: value.name.trim(), slug: value.slug });
        } catch (error) {
          // Better Auth's own message names its model, an organization.
          const taken = errorCode(error) === "ORGANIZATION_ALREADY_EXISTS";
          return taken ? "That URL is taken; choose another" : errorMessage(error);
        }
      },
    },
    onSubmit: async ({ value }) => {
      await queryClient.invalidateQueries({ queryKey: workspacesQuery.queryKey });
      await navigate({ to: "/$workspaceSlug", params: { workspaceSlug: value.slug } });
    },
  });

  return (
    <AuthCard title="Create a workspace" description="Workspaces hold your projects, issues and team.">
      <form.AppForm>
        <form onSubmit={submits(form)}>
          <CardContent>
            <FieldGroup>
              <form.AppField
                name="name"
                listeners={{
                  onChange: ({ value }) => {
                    if (!form.getFieldMeta("slug")?.isDirty)
                      form.setFieldValue("slug", slugify(value), { dontUpdateMeta: true });
                  },
                }}
              >
                {(field) => <field.TextField label="Name" autoFocus />}
              </form.AppField>
              <form.AppField name="slug">{(field) => <field.TextField label="URL" placeholder="acme" />}</form.AppField>
              <form.FormError />
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6">
            <form.SubmitButton className="w-full">Create workspace</form.SubmitButton>
          </CardFooter>
        </form>
      </form.AppForm>
    </AuthCard>
  );
}

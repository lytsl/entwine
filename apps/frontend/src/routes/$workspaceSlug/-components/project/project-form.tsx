import { projectInput } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { FieldGroup } from "@entwine/ui/components/ui/field";
import { useNavigate } from "@tanstack/react-router";
import { useAppForm } from "../../../../hooks/use-app-form";
import { useStore } from "../../../../hooks/use-store";
import { submits } from "../../../../lib/form";
import { suggestIdentifier } from "../../../../lib/suggest";
import { type Project } from "../../../../types/rows";

/** Identifiers are unique, which the local rows can check; the server checks again. */
export function ProjectForm({
  project,
  onSaved,
  onCancel,
}: {
  project?: Project;
  onSaved?(): void;
  onCancel?(): void;
}) {
  const store = useStore();
  const navigate = useNavigate({ from: "/$workspaceSlug" });
  const form = useAppForm({
    defaultValues: {
      name: project?.name ?? "",
      identifier: project?.identifier ?? "",
      description: project?.description ?? "",
    },
    validators: {
      onSubmit: projectInput,
      // Runs once the schema passes: a form has one validator of each kind.
      onSubmitAsync: async ({ value }) => {
        const identifier = value.identifier.trim().toUpperCase();
        const taken = store.projects.sorted.some((p) => p.identifier === identifier && p.id !== project?.id);
        if (taken) return `Identifier ${identifier} is taken`;
      },
    },
    onSubmit: ({ value }) => {
      const input = {
        name: value.name.trim(),
        identifier: value.identifier.trim().toUpperCase(),
        description: value.description,
      };
      if (project) void store.projects.update(project.id, input);
      else
        void navigate({
          to: "/$workspaceSlug/projects/$projectId",
          params: { projectId: store.projects.create(input) },
        });
      onSaved?.();
    },
  });

  return (
    <form.AppForm>
      <form onSubmit={submits(form)}>
        <FieldGroup>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <form.AppField
              name="name"
              listeners={{
                // A new project's identifier follows its name until the member types one.
                onChange: ({ value }) => {
                  if (!project && !form.getFieldMeta("identifier")?.isDirty)
                    form.setFieldValue("identifier", suggestIdentifier(value), { dontUpdateMeta: true });
                },
              }}
            >
              {(field) => <field.TextField label="Name" autoFocus={!project} placeholder="Website" />}
            </form.AppField>
            <form.AppField name="identifier">
              {(field) => <field.TextField label="Identifier" placeholder="WEB" maxLength={5} className="uppercase" />}
            </form.AppField>
          </div>
          <form.AppField name="description">
            {(field) => <field.TextField label="Description" multiline />}
          </form.AppField>
          <form.FormError />
        </FieldGroup>
        <div className="mt-6 flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <form.Subscribe selector={(state) => state.isDirty}>
            {(dirty) => (
              <Button type="submit" disabled={!!project && !dirty}>
                {project ? "Save changes" : "Create project"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </form.AppForm>
  );
}

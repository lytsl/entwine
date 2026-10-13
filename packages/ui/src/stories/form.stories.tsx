import { Button } from "@entwine/ui/components/ui/button";
import { Checkbox } from "@entwine/ui/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@entwine/ui/components/ui/field";
import { Input } from "@entwine/ui/components/ui/input";
import { Switch } from "@entwine/ui/components/ui/switch";
import { Textarea } from "@entwine/ui/components/ui/textarea";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Base/Form" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceSettings: Story = {
  render: () => (
    <form className="max-w-md">
      <FieldSet>
        <FieldLegend>Workspace</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="workspace-name">Name</FieldLabel>
            <Input id="workspace-name" defaultValue="Entwine" />
            <FieldDescription>Names the local database and the server tenant.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="workspace-notes">Notes</FieldLabel>
            <Textarea id="workspace-notes" rows={3} placeholder="Anything worth remembering…" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="offline" defaultChecked />
            <FieldLabel htmlFor="offline">Keep working offline</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Switch id="inspector" />
            <FieldLabel htmlFor="inspector">Show the sync inspector</FieldLabel>
          </Field>
          <Button type="submit" className="self-start">
            Save
          </Button>
        </FieldGroup>
      </FieldSet>
    </form>
  ),
};

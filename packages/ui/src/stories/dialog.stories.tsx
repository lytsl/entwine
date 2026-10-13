import { Button } from "@entwine/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@entwine/ui/components/ui/dialog";
import { Field, FieldLabel } from "@entwine/ui/components/ui/field";
import { Input } from "@entwine/ui/components/ui/input";
import { Textarea } from "@entwine/ui/components/ui/textarea";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Base/Dialog",
  component: Dialog,
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewIssue: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button>New issue</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>Created locally, then synced when the engine drains its queue.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="issue-title">Title</FieldLabel>
          <Input id="issue-title" placeholder="Issue title" />
        </Field>
        <Field>
          <FieldLabel htmlFor="issue-description">Description</FieldLabel>
          <Textarea id="issue-description" placeholder="Add a description…" rows={4} />
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button>Create issue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

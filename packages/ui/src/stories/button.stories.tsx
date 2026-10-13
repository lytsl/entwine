import { Button } from "@entwine/ui/components/ui/button";
import { ButtonGroup } from "@entwine/ui/components/ui/button-group";
import { Spinner } from "@entwine/ui/components/ui/spinner";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRightIcon, PlusIcon } from "lucide-react";

const meta = {
  title: "Base/Button",
  component: Button,
  args: { children: "Create issue" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link"],
    },
    size: { control: "select", options: ["xs", "sm", "default", "lg", "icon"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} variant="default" />
      <Button {...args} variant="outline" />
      <Button {...args} variant="secondary" />
      <Button {...args} variant="ghost" />
      <Button {...args} variant="destructive" />
      <Button {...args} variant="link" />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} size="xs" />
      <Button {...args} size="sm" />
      <Button {...args} size="default" />
      <Button {...args} size="lg" />
      <Button size="icon" aria-label="New issue">
        <PlusIcon />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        Open issue
        <ArrowRightIcon data-icon="inline-end" />
      </>
    ),
  },
};

export const Pending: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <Spinner />
        Saving
      </>
    ),
  },
};

export const Grouped: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Backlog</Button>
      <Button variant="outline">Todo</Button>
      <Button variant="outline">In progress</Button>
    </ButtonGroup>
  ),
};

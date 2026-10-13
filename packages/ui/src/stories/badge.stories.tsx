import { Badge } from "@entwine/ui/components/ui/badge";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDotIcon } from "lucide-react";

const meta = {
  title: "Base/Badge",
  component: Badge,
  args: { children: "In progress" },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "outline", "destructive"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge {...args} variant="default" />
      <Badge {...args} variant="secondary" />
      <Badge {...args} variant="outline" />
      <Badge {...args} variant="destructive" />
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    variant: "outline",
    children: (
      <>
        <CircleDotIcon />
        ENT-128
      </>
    ),
  },
};

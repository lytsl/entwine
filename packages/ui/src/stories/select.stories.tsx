import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@entwine/ui/components/ui/select";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Base/Select",
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const State: Story = {
  render: () => (
    <Select defaultValue="started">
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="backlog">Backlog</SelectItem>
        <SelectItem value="unstarted">Todo</SelectItem>
        <SelectItem value="started">In progress</SelectItem>
        <SelectItem value="completed">Done</SelectItem>
        <SelectItem value="canceled">Canceled</SelectItem>
      </SelectContent>
    </Select>
  ),
};

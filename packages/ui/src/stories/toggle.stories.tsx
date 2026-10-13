import { Toggle } from "@entwine/ui/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@entwine/ui/components/ui/toggle-group";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BellIcon, LayoutGridIcon, ListIcon, RowsIcon } from "lucide-react";

const meta = { title: "Base/Toggle", component: Toggle } satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Toggle aria-label="Subscribe">
        <BellIcon />
      </Toggle>
      <Toggle variant="outline" defaultPressed>
        Archived
      </Toggle>
      <Toggle variant="outline" disabled>
        Deleted
      </Toggle>
    </div>
  ),
};

export const ViewMode: Story = {
  render: () => (
    <ToggleGroup variant="outline" defaultValue={["list"]}>
      <ToggleGroupItem value="list" aria-label="List">
        <ListIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="board" aria-label="Board">
        <LayoutGridIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="rows" aria-label="Rows">
        <RowsIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Filters: Story = {
  render: () => (
    <ToggleGroup multiple variant="outline" size="sm" defaultValue={["started", "unstarted"]}>
      <ToggleGroupItem value="backlog">Backlog</ToggleGroupItem>
      <ToggleGroupItem value="unstarted">Todo</ToggleGroupItem>
      <ToggleGroupItem value="started">In progress</ToggleGroupItem>
      <ToggleGroupItem value="completed">Done</ToggleGroupItem>
    </ToggleGroup>
  ),
};

import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Base/DropdownMenu",
  component: DropdownMenu,
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IssueActions: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">ENT-128</Button>} />
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Issue</DropdownMenuLabel>
        <DropdownMenuItem>
          Rename
          <DropdownMenuShortcut>R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          Assign to me
          <DropdownMenuShortcut>I</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        <DropdownMenuRadioGroup defaultValue="2">
          <DropdownMenuRadioItem value="1">Urgent</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="2">High</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="3">Medium</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="4">Low</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

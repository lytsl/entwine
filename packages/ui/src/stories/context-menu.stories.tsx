import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@entwine/ui/components/ui/context-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Base/ContextMenu", component: ContextMenu } satisfies Meta<typeof ContextMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IssueRow: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-24 w-96 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Right-click ENT-128
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>ENT-128</ContextMenuLabel>
        <ContextMenuItem>
          Rename
          <ContextMenuShortcut>R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Copy link
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem>Engineering</ContextMenuItem>
            <ContextMenuItem>Design</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuLabel>Status</ContextMenuLabel>
        <ContextMenuRadioGroup defaultValue="started">
          <ContextMenuRadioItem value="backlog">Backlog</ContextMenuRadioItem>
          <ContextMenuRadioItem value="unstarted">Todo</ContextMenuRadioItem>
          <ContextMenuRadioItem value="started">In progress</ContextMenuRadioItem>
          <ContextMenuRadioItem value="completed">Done</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem defaultChecked>Subscribed</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          Archive
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@entwine/ui/components/ui/command";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDashedIcon, SearchIcon, UserIcon } from "lucide-react";

const meta = {
  title: "Base/Command",
  component: Command,
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Palette: Story = {
  render: () => (
    <Command className="max-w-md rounded-lg border">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading="Issues">
          <CommandItem>
            <SearchIcon />
            Search issues
            <CommandShortcut>Ctrl K</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <CircleDashedIcon />
            Change state
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <UserIcon />
            Assign
            <CommandShortcut>A</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Engine">
          <CommandItem>Refresh local database</CommandItem>
          <CommandItem>Toggle the sync inspector</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

import { Button } from "@entwine/ui/components/ui/button";
import { Kbd, KbdGroup } from "@entwine/ui/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@entwine/ui/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@entwine/ui/components/ui/tooltip";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Base/Overlays" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tooltips: Story = {
  render: () => (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline">New issue</Button>} />
          <TooltipContent>
            Create an issue <Kbd>C</Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="outline">Search</Button>} />
          <TooltipContent side="bottom">
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
};

export const Popovers: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Sync status</Button>} />
      <PopoverContent className="w-72 text-sm">
        <p className="font-medium">Connected</p>
        <p className="text-muted-foreground">lastSyncId 4192 · 0 queued · 0 unsynced</p>
      </PopoverContent>
    </Popover>
  ),
};

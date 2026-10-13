import { Separator } from "@entwine/ui/components/ui/separator";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Base/Separator", component: Separator } satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-80">
      <div className="text-sm font-medium">Engineering</div>
      <div className="text-sm text-muted-foreground">ENT</div>
      <Separator className="my-3" />
      <div className="text-sm text-muted-foreground">12 issues across 4 states.</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-3 text-sm text-muted-foreground">
      <span>All</span>
      <Separator orientation="vertical" />
      <span>Active</span>
      <Separator orientation="vertical" />
      <span>Backlog</span>
    </div>
  ),
};

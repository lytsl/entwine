import { Button } from "@entwine/ui/components/ui/button";
import { LoadingPage, PageShell } from "@entwine/ui/components/ui/page-shell";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Base/Page shell",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <LoadingPage label="Opening workspace…" />,
};

export const Empty: Story = {
  render: () => (
    <PageShell>
      <div className="text-center">
        <p className="text-sm">That workspace is unavailable.</p>
        <Button className="mt-4">Choose another workspace</Button>
      </div>
    </PageShell>
  ),
};

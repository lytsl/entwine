import { Button } from "@entwine/ui/components/ui/button";
import { toast } from "@entwine/ui/components/ui/toast";
import type { Meta, StoryObj } from "@storybook/react-vite";

// The `<Toaster />` is mounted for every story by `.storybook/preview.tsx`.
const meta = { title: "Base/Notifications" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => toast.success("Queue drained", { description: "syncId 4192" })}>
        Success
      </Button>
      <Button variant="outline" onClick={() => toast.info("Bootstrapping", { description: "Loading sync groups…" })}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning("Offline", { description: "Mutations are queued." })}>
        Warning
      </Button>
      <Button variant="outline" onClick={() => toast.error("Transaction rejected", { description: "Stale delta." })}>
        Error
      </Button>
    </div>
  ),
};

export const WithUndo: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast.info("ENT-128 archived", {
          action: { label: "Undo", onClick: () => toast.success("Restored") },
        })
      }
    >
      Archive issue
    </Button>
  ),
};

export const Pending: Story = {
  render: () => (
    <Button
      variant="outline"
      onClick={() =>
        toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
          loading: "Draining the queue…",
          success: "3 transactions acked",
          error: "The stream dropped",
        })
      }
    >
      Drain queue
    </Button>
  ),
};

import { ScrollArea } from "@entwine/ui/components/ui/scroll-area";
import { Separator } from "@entwine/ui/components/ui/separator";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Base/ScrollArea", component: ScrollArea } satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const deltas = Array.from({ length: 40 }, (_, i) => ({
  syncId: 4192 - i,
  action: ["I", "U", "A"][i % 3],
  model: ["Issue", "Comment", "IssueLabel", "WorkflowState"][i % 4],
}));

export const TransactionLog: Story = {
  render: () => (
    <ScrollArea className="h-72 w-96 rounded-md border">
      <div className="p-3 font-mono text-xs">
        {deltas.map((delta) => (
          <div key={delta.syncId}>
            <div className="flex gap-3 py-1">
              <span className="text-muted-foreground">{delta.syncId}</span>
              <span>{delta.action}</span>
              <span className="text-muted-foreground">{delta.model}</span>
            </div>
            <Separator />
          </div>
        ))}
      </div>
    </ScrollArea>
  ),
};

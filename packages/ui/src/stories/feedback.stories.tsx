import { Alert, AlertDescription, AlertTitle } from "@entwine/ui/components/ui/alert";
import { Button } from "@entwine/ui/components/ui/button";
import { Progress } from "@entwine/ui/components/ui/progress";
import { Skeleton } from "@entwine/ui/components/ui/skeleton";
import { Spinner } from "@entwine/ui/components/ui/spinner";
import { toast } from "@entwine/ui/components/ui/toast";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TriangleAlertIcon } from "lucide-react";

const meta = { title: "Base/Feedback" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Offline: Story = {
  render: () => (
    <Alert className="max-w-md">
      <TriangleAlertIcon />
      <AlertTitle>Offline</AlertTitle>
      <AlertDescription>Work is kept locally. The queue drains when the stream reconnects.</AlertDescription>
    </Alert>
  ),
};

export const Bootstrapping: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-4">
      <Progress value={62} />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading the full bootstrap…
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  ),
};

export const Toast: Story = {
  render: () => (
    <Button variant="outline" onClick={() => toast.success("ENT-128 synced", { description: "syncId 4192" })}>
      Show toast
    </Button>
  ),
};

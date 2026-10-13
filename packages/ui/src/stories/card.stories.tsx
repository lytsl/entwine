import { Badge } from "@entwine/ui/components/ui/badge";
import { Button } from "@entwine/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@entwine/ui/components/ui/card";
import { Progress } from "@entwine/ui/components/ui/progress";
import { Separator } from "@entwine/ui/components/ui/separator";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Base/Card", component: Card } satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SyncGroup: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>The root sync group. Every user in the workspace loads it.</CardDescription>
        <CardAction>
          <Badge variant="secondary">1 model</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>lastSyncId</span>
          <span className="font-mono text-foreground">4192</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span>Partial models</span>
          <span className="font-mono text-foreground">0</span>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Inspect
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const Bootstrap: Story = {
  render: () => (
    <Card className="w-96" size="sm">
      <CardHeader>
        <CardTitle>Full bootstrap</CardTitle>
        <CardDescription>Loading every sync group the session can see.</CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={62} />
      </CardContent>
    </Card>
  ),
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@entwine/ui/components/ui/tabs";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Base/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inspector: Story = {
  render: () => (
    <Tabs defaultValue="queues" className="max-w-lg">
      <TabsList>
        <TabsTrigger value="queues">Queues</TabsTrigger>
        <TabsTrigger value="groups">Sync groups</TabsTrigger>
        <TabsTrigger value="cursor">Cursor</TabsTrigger>
      </TabsList>
      <TabsContent value="queues" className="text-sm text-muted-foreground">
        0 created · 0 queued · 0 completed but unsynced.
      </TabsContent>
      <TabsContent value="groups" className="text-sm text-muted-foreground">
        workspace, team:core, user:me.
      </TabsContent>
      <TabsContent value="cursor" className="text-sm text-muted-foreground">
        lastSyncId 4192, full bootstrap.
      </TabsContent>
    </Tabs>
  ),
};

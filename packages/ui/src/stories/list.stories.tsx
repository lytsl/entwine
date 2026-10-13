import { Avatar, AvatarFallback } from "@entwine/ui/components/ui/avatar";
import { Badge } from "@entwine/ui/components/ui/badge";
import { Button } from "@entwine/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@entwine/ui/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@entwine/ui/components/ui/item";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircleDashedIcon, InboxIcon } from "lucide-react";

const meta = { title: "Base/Issue list" } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const issues = [
  { id: "ENT-128", title: "Rebase unsynced transactions oldest first", state: "In progress", who: "RK" },
  { id: "ENT-131", title: "Refuse a local reset while offline", state: "Todo", who: "AM" },
  { id: "ENT-134", title: "Hold lastSyncId across a gap", state: "Backlog", who: "TS" },
];

export const Populated: Story = {
  render: () => (
    <ItemGroup className="max-w-2xl">
      {issues.map((issue) => (
        <Item key={issue.id} variant="outline">
          <ItemMedia>
            <CircleDashedIcon className="size-4 text-muted-foreground" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{issue.title}</ItemTitle>
            <ItemDescription>{issue.id}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">{issue.state}</Badge>
            <Avatar className="size-6">
              <AvatarFallback>{issue.who}</AvatarFallback>
            </Avatar>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  ),
};

export const NoIssues: Story = {
  render: () => (
    <Empty className="max-w-2xl">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>No issues</EmptyTitle>
        <EmptyDescription>Nothing in this view yet. Create one and it syncs on the next drain.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>New issue</Button>
      </EmptyContent>
    </Empty>
  ),
};
